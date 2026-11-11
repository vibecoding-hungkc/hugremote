import fs from 'fs';
import path from 'path';
import { LOCAL_WORKSPACE, ALLOWED_ROOT, sanitizeRemoteWorkspacePath } from '../config.js';
import { sshPool } from './sshPool.js';
function shellQuotePosix(val) {
    return `'${String(val).replace(/'/g, "'\\''")}'`;
}
export class FsService {
    resolveLocalPath(requestedPath, workspaceOverride, strictWorkspace = false) {
        let base = workspaceOverride || LOCAL_WORKSPACE;
        if (!fs.existsSync(base)) {
            try {
                fs.mkdirSync(base, { recursive: true });
            }
            catch (_) { }
        }
        const target = requestedPath
            ? path.resolve(base, requestedPath)
            : base;
        const canonicalRoot = fs.existsSync(ALLOWED_ROOT)
            ? fs.realpathSync(ALLOWED_ROOT)
            : path.resolve(ALLOWED_ROOT);
        const rootWithSep = canonicalRoot.endsWith(path.sep) ? canonicalRoot : canonicalRoot + path.sep;
        const canonicalBase = fs.existsSync(base)
            ? fs.realpathSync(base)
            : path.resolve(base);
        const baseWithSep = canonicalBase.endsWith(path.sep) ? canonicalBase : canonicalBase + path.sep;
        const withinBase = (candidate) => !strictWorkspace || candidate === canonicalBase || candidate.startsWith(baseWithSep);
        // If target exists, dereference symlinks to inspect real destination
        if (fs.existsSync(target)) {
            const canonicalTarget = fs.realpathSync(target);
            const inPermittedRoot = canonicalTarget === canonicalRoot || canonicalTarget.startsWith(rootWithSep) || canonicalTarget === canonicalBase || canonicalTarget.startsWith(baseWithSep);
            const isAllowed = inPermittedRoot && withinBase(canonicalTarget);
            if (!isAllowed) {
                throw new Error('Access denied: Path resolves outside permitted root (symlink escape detected)');
            }
            return canonicalTarget;
        }
        // If target does not exist yet (e.g. creating a new file/dir), verify parent directory
        const parentDir = path.dirname(target);
        if (fs.existsSync(parentDir)) {
            const canonicalParent = fs.realpathSync(parentDir);
            const inPermittedParent = canonicalParent === canonicalRoot || canonicalParent.startsWith(rootWithSep) || canonicalParent === canonicalBase || canonicalParent.startsWith(baseWithSep);
            const isAllowed = inPermittedParent && withinBase(canonicalParent);
            if (!isAllowed) {
                throw new Error('Access denied: Parent directory resolves outside permitted root');
            }
        }
        else {
            const inPermitted = (target === canonicalRoot || target.startsWith(rootWithSep) || target === canonicalBase || target.startsWith(baseWithSep));
            const isAllowed = inPermitted && withinBase(target);
            if (!isAllowed) {
                throw new Error('Access denied: Path is outside permitted root');
            }
        }
        return target;
    }
    // --- LOCAL FS ---
    async listLocal(relPath = '', workspaceOverride, strictWorkspace = false) {
        let base = workspaceOverride || LOCAL_WORKSPACE;
        if (!fs.existsSync(base)) {
            try {
                fs.mkdirSync(base, { recursive: true });
            }
            catch (_) { }
        }
        const targetDir = this.resolveLocalPath(relPath, base, strictWorkspace);
        if (!fs.existsSync(targetDir)) {
            if (!relPath) {
                try {
                    fs.mkdirSync(targetDir, { recursive: true });
                }
                catch (_) { }
            }
            else {
                throw new Error('Directory does not exist');
            }
        }
        const dirents = fs.readdirSync(targetDir, { withFileTypes: true });
        const entries = dirents
            .filter((e) => !e.name.startsWith('.git') && e.name !== 'node_modules')
            .map((e) => {
            const full = path.join(targetDir, e.name);
            const isDir = e.isDirectory();
            let size = 0;
            let mtime = null;
            try {
                const s = fs.statSync(full);
                size = s.size;
                mtime = s.mtime.toISOString();
            }
            catch (_) { }
            return {
                name: e.name,
                isDirectory: isDir,
                size,
                mtime,
                ext: isDir ? '' : path.extname(e.name).toLowerCase(),
                relPath: path.relative(base, full),
            };
        })
            .sort((a, b) => {
            if (a.isDirectory !== b.isDirectory)
                return a.isDirectory ? -1 : 1;
            return a.name.localeCompare(b.name);
        });
        const canonicalBase = fs.existsSync(base) ? fs.realpathSync(base) : path.resolve(base);
        const parentDir = (targetDir === ALLOWED_ROOT || (strictWorkspace && targetDir === canonicalBase)) ? null : path.dirname(targetDir);
        const parentRel = parentDir ? path.relative(base, parentDir) : null;
        return {
            currentRel: path.relative(base, targetDir),
            parentRel,
            entries,
        };
    }
    async readLocalFile(relPath, workspaceOverride, strictWorkspace = false) {
        const filePath = this.resolveLocalPath(relPath, workspaceOverride, strictWorkspace);
        if (!fs.existsSync(filePath))
            throw new Error('File not found');
        const stat = fs.statSync(filePath);
        if (stat.isDirectory())
            throw new Error('Path is a directory, not a file');
        if (stat.size > 10 * 1024 * 1024)
            throw new Error('File too large (> 10MB)');
        const content = fs.readFileSync(filePath, 'utf8');
        return {
            name: path.basename(filePath),
            size: stat.size,
            content,
        };
    }
    async writeLocalFile(relPath, content, workspaceOverride, strictWorkspace = false) {
        const filePath = this.resolveLocalPath(relPath, workspaceOverride, strictWorkspace);
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir))
            fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(filePath, content || '', 'utf8');
        const stat = fs.statSync(filePath);
        return { size: stat.size };
    }
    async createLocal(relPath, type, workspaceOverride, strictWorkspace = false) {
        const target = this.resolveLocalPath(relPath, workspaceOverride, strictWorkspace);
        if (fs.existsSync(target))
            throw new Error('Item already exists');
        if (type === 'dir') {
            fs.mkdirSync(target, { recursive: true });
        }
        else {
            const dir = path.dirname(target);
            if (!fs.existsSync(dir))
                fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(target, '', 'utf8');
        }
    }
    async deleteLocal(relPath, workspaceOverride, strictWorkspace = false) {
        const base = workspaceOverride || LOCAL_WORKSPACE;
        const target = this.resolveLocalPath(relPath, workspaceOverride, strictWorkspace);
        if (target === ALLOWED_ROOT || target === base) {
            throw new Error('Cannot delete root workspace');
        }
        if (!fs.existsSync(target))
            throw new Error('Target not found');
        fs.rmSync(target, { recursive: true, force: true });
    }
    async renameLocal(oldRel, newRel, workspaceOverride, strictWorkspace = false) {
        const oldTarget = this.resolveLocalPath(oldRel, workspaceOverride, strictWorkspace);
        const newTarget = this.resolveLocalPath(newRel, workspaceOverride, strictWorkspace);
        if (!fs.existsSync(oldTarget))
            throw new Error('Source not found');
        if (fs.existsSync(newTarget))
            throw new Error('Destination already exists');
        fs.renameSync(oldTarget, newTarget);
    }
    // --- REMOTE SFTP & NATIVE SSH FALLBACK FS ---
    resolveRemotePath(server, requestedPath = '', workspaceOverride) {
        const home = server.user && server.user !== 'root' ? `/home/${server.user}` : '/root';
        const base = sanitizeRemoteWorkspacePath(workspaceOverride || server.workspace || home, server.user);
        if (!requestedPath || requestedPath === '.')
            return base;
        if (requestedPath.startsWith('/Users/')) {
            return sanitizeRemoteWorkspacePath(requestedPath, server.user);
        }
        if (path.posix.isAbsolute(requestedPath))
            return path.posix.normalize(requestedPath);
        if (requestedPath === '~')
            return home;
        if (requestedPath.startsWith('~/')) {
            return path.posix.normalize(path.posix.join(home, requestedPath.slice(2)));
        }
        return path.posix.normalize(path.posix.join(base, requestedPath));
    }
    async sftpMkdirRecursive(sftp, targetDir) {
        const normalized = path.posix.normalize(targetDir);
        const parts = normalized.split('/').filter(Boolean);
        let current = normalized.startsWith('/') ? '/' : '';
        for (const part of parts) {
            current = path.posix.join(current, part);
            await new Promise((resolve) => {
                sftp.stat(current, (err, stat) => {
                    if (!err && stat) {
                        return resolve();
                    }
                    sftp.mkdir(current, () => {
                        resolve();
                    });
                });
            });
        }
    }
    async sftpRmRecursive(sftp, targetPath) {
        const stat = await new Promise((resolve, reject) => {
            sftp.lstat(targetPath, (err, st) => {
                if (err)
                    return reject(err);
                resolve(st);
            });
        });
        const isDir = (stat.mode & 0o170000) === 0o040000;
        if (!isDir) {
            return new Promise((resolve, reject) => {
                sftp.unlink(targetPath, (err) => {
                    if (err)
                        return reject(err);
                    resolve();
                });
            });
        }
        const list = await new Promise((resolve, reject) => {
            sftp.readdir(targetPath, (err, items) => {
                if (err)
                    return reject(err);
                resolve(items || []);
            });
        });
        for (const item of list) {
            if (item.filename === '.' || item.filename === '..')
                continue;
            const childPath = path.posix.join(targetPath, item.filename);
            await this.sftpRmRecursive(sftp, childPath);
        }
        return new Promise((resolve, reject) => {
            sftp.rmdir(targetPath, (err) => {
                if (err)
                    return reject(err);
                resolve();
            });
        });
    }
    async listRemote(server, dirPath = '', workspaceOverride) {
        const base = this.resolveRemotePath(server, '', workspaceOverride);
        const targetDir = this.resolveRemotePath(server, dirPath, workspaceOverride);
        const parentRel = targetDir === '/' || targetDir === base ? null : path.posix.relative(base, path.posix.dirname(targetDir));
        const currentRel = path.posix.relative(base, targetDir);
        try {
            const sftp = await sshPool.getSftp(server);
            return await new Promise((resolve, reject) => {
                sftp.readdir(targetDir, (err, list) => {
                    if (err)
                        return reject(err);
                    const entries = (list || [])
                        .filter((e) => !e.filename.startsWith('.git') && e.filename !== 'node_modules')
                        .map((e) => {
                        const isDir = (e.attrs.mode & 0o170000) === 0o040000;
                        return {
                            name: e.filename,
                            isDirectory: isDir,
                            size: e.attrs.size || 0,
                            mtime: e.attrs.mtime ? new Date(e.attrs.mtime * 1000).toISOString() : null,
                            ext: isDir ? '' : path.extname(e.filename).toLowerCase(),
                            relPath: path.posix.relative(base, path.posix.join(targetDir, e.filename)),
                        };
                    })
                        .sort((a, b) => {
                        if (a.isDirectory !== b.isDirectory)
                            return a.isDirectory ? -1 : 1;
                        return a.name.localeCompare(b.name);
                    });
                    resolve({
                        currentRel,
                        parentRel,
                        entries,
                    });
                });
            });
        }
        catch {
            const pyScript = [
                'import os, sys, json',
                'from datetime import datetime, timezone',
                'd = os.path.expanduser(sys.argv[1])',
                'allow_home_fallback = sys.argv[2] == "1"',
                'if not os.path.isdir(d):',
                '    home_d = os.path.expanduser("~")',
                '    if allow_home_fallback and os.path.isdir(home_d):',
                '        d = home_d',
                '    else:',
                '        sys.exit(44)',
                'out = []',
                'for name in os.listdir(d):',
                '    if name.startswith(".git") or name == "node_modules": continue',
                '    full = os.path.join(d, name)',
                '    try:',
                '        st = os.stat(full)',
                '        is_dir = os.path.isdir(full)',
                '        mtime = datetime.fromtimestamp(st.st_mtime, tz=timezone.utc).isoformat().replace("+00:00", "Z")',
                '        out.append({"name": name, "isDirectory": is_dir, "size": 0 if is_dir else st.st_size, "mtime": mtime})',
                '    except Exception:',
                '        out.append({"name": name, "isDirectory": os.path.isdir(full), "size": 0, "mtime": None})',
                'print(json.dumps(out))',
            ].join('\n');
            const allowHomeFallback = !dirPath && !workspaceOverride ? '1' : '0';
            const cmd = `python3 -c ${shellQuotePosix(pyScript)} ${shellQuotePosix(targetDir)} ${allowHomeFallback}`;
            const res = await sshPool.runRemoteCommand(server, cmd);
            if (res.exitCode === 44) {
                throw new Error('Directory does not exist');
            }
            if (res.exitCode !== 0) {
                throw new Error(res.stderr.trim() || `Failed to list remote directory (exit code ${res.exitCode})`);
            }
            const rawItems = JSON.parse(res.stdout.toString('utf8').trim() || '[]');
            const entries = rawItems
                .map((item) => ({
                name: item.name,
                isDirectory: Boolean(item.isDirectory),
                size: Number(item.size || 0),
                mtime: item.mtime || null,
                ext: item.isDirectory ? '' : path.extname(item.name).toLowerCase(),
                relPath: path.posix.relative(base, path.posix.join(targetDir, item.name)),
            }))
                .sort((a, b) => {
                if (a.isDirectory !== b.isDirectory)
                    return a.isDirectory ? -1 : 1;
                return a.name.localeCompare(b.name);
            });
            return {
                currentRel,
                parentRel,
                entries,
            };
        }
    }
    async readRemoteFile(server, filePath, workspaceOverride) {
        const targetPath = this.resolveRemotePath(server, filePath, workspaceOverride);
        try {
            const sftp = await sshPool.getSftp(server);
            return await new Promise((resolve, reject) => {
                sftp.readFile(targetPath, (err, data) => {
                    if (err)
                        return reject(err);
                    const content = data.toString('utf8');
                    resolve({
                        name: path.posix.basename(targetPath),
                        size: Buffer.byteLength(content, 'utf8'),
                        content,
                    });
                });
            });
        }
        catch {
            const qTarget = shellQuotePosix(targetPath);
            const cmd = `if [ ! -e ${qTarget} ]; then exit 44; fi; if [ -d ${qTarget} ]; then exit 45; fi; cat -- ${qTarget}`;
            const res = await sshPool.runRemoteCommand(server, cmd);
            if (res.exitCode === 44)
                throw new Error('File not found');
            if (res.exitCode === 45)
                throw new Error('Path is a directory, not a file');
            if (res.exitCode !== 0)
                throw new Error(res.stderr.trim() || `Failed to read remote file (exit code ${res.exitCode})`);
            const content = res.stdout.toString('utf8');
            return {
                name: path.posix.basename(targetPath),
                size: Buffer.byteLength(content, 'utf8'),
                content,
            };
        }
    }
    async writeRemoteFile(server, filePath, content, workspaceOverride) {
        const targetPath = this.resolveRemotePath(server, filePath, workspaceOverride);
        const parentDir = path.posix.dirname(targetPath);
        try {
            const sftp = await sshPool.getSftp(server);
            await this.sftpMkdirRecursive(sftp, parentDir);
            return await new Promise((resolve, reject) => {
                sftp.writeFile(targetPath, content || '', 'utf8', (err) => {
                    if (err)
                        return reject(err);
                    resolve({ size: Buffer.byteLength(content || '', 'utf8') });
                });
            });
        }
        catch {
            const buf = Buffer.from(content || '', 'utf8');
            const cmd = `mkdir -p -- ${shellQuotePosix(parentDir)} && cat > ${shellQuotePosix(targetPath)}`;
            const res = await sshPool.runRemoteCommand(server, cmd, buf);
            if (res.exitCode !== 0) {
                throw new Error(res.stderr.trim() || `Failed to write remote file (exit code ${res.exitCode})`);
            }
            return { size: buf.length };
        }
    }
    async createRemote(server, relPath, type, workspaceOverride) {
        const target = this.resolveRemotePath(server, relPath, workspaceOverride);
        try {
            const sftp = await sshPool.getSftp(server);
            const exists = await new Promise((resolve) => {
                sftp.stat(target, (err) => {
                    resolve(!err);
                });
            });
            if (exists) {
                throw new Error('Item already exists');
            }
            if (type === 'dir') {
                await this.sftpMkdirRecursive(sftp, target);
            }
            else {
                const parentDir = path.posix.dirname(target);
                await this.sftpMkdirRecursive(sftp, parentDir);
                await new Promise((resolve, reject) => {
                    sftp.writeFile(target, '', 'utf8', (err) => {
                        if (err)
                            return reject(err);
                        resolve();
                    });
                });
            }
        }
        catch (err) {
            if (err?.message === 'Item already exists')
                throw err;
            const qTarget = shellQuotePosix(target);
            const qParent = shellQuotePosix(path.posix.dirname(target));
            const cmd = type === 'dir'
                ? `if [ -e ${qTarget} ]; then exit 46; fi; mkdir -p -- ${qTarget}`
                : `if [ -e ${qTarget} ]; then exit 46; fi; mkdir -p -- ${qParent} && : > ${qTarget}`;
            const res = await sshPool.runRemoteCommand(server, cmd);
            if (res.exitCode === 46)
                throw new Error('Item already exists');
            if (res.exitCode !== 0) {
                throw new Error(res.stderr.trim() || `Failed to create remote item (exit code ${res.exitCode})`);
            }
        }
    }
    async deleteRemote(server, relPath, workspaceOverride) {
        const base = this.resolveRemotePath(server, '', workspaceOverride);
        const target = this.resolveRemotePath(server, relPath, workspaceOverride);
        if (target === '/' || target === base) {
            throw new Error('Cannot delete root workspace');
        }
        try {
            const sftp = await sshPool.getSftp(server);
            const exists = await new Promise((resolve) => {
                sftp.stat(target, (err) => {
                    resolve(!err);
                });
            });
            if (!exists) {
                throw new Error('Target not found');
            }
            await this.sftpRmRecursive(sftp, target);
        }
        catch (err) {
            if (err?.message === 'Target not found')
                throw err;
            const qTarget = shellQuotePosix(target);
            const cmd = `if [ ! -e ${qTarget} ]; then exit 44; fi; rm -rf -- ${qTarget}`;
            const res = await sshPool.runRemoteCommand(server, cmd);
            if (res.exitCode === 44)
                throw new Error('Target not found');
            if (res.exitCode !== 0) {
                throw new Error(res.stderr.trim() || `Failed to delete remote item (exit code ${res.exitCode})`);
            }
        }
    }
    async renameRemote(server, oldRel, newRel, workspaceOverride) {
        const oldTarget = this.resolveRemotePath(server, oldRel, workspaceOverride);
        const newTarget = this.resolveRemotePath(server, newRel, workspaceOverride);
        try {
            const sftp = await sshPool.getSftp(server);
            const oldExists = await new Promise((resolve) => {
                sftp.stat(oldTarget, (err) => {
                    resolve(!err);
                });
            });
            if (!oldExists) {
                throw new Error('Source not found');
            }
            const newExists = await new Promise((resolve) => {
                sftp.stat(newTarget, (err) => {
                    resolve(!err);
                });
            });
            if (newExists) {
                throw new Error('Destination already exists');
            }
            const newParent = path.posix.dirname(newTarget);
            await this.sftpMkdirRecursive(sftp, newParent);
            await new Promise((resolve, reject) => {
                sftp.rename(oldTarget, newTarget, (err) => {
                    if (err)
                        return reject(err);
                    resolve();
                });
            });
        }
        catch (err) {
            if (err?.message === 'Source not found' || err?.message === 'Destination already exists')
                throw err;
            const qOld = shellQuotePosix(oldTarget);
            const qNew = shellQuotePosix(newTarget);
            const qNewParent = shellQuotePosix(path.posix.dirname(newTarget));
            const cmd = `if [ ! -e ${qOld} ]; then exit 44; fi; if [ -e ${qNew} ]; then exit 46; fi; mkdir -p -- ${qNewParent} && mv -- ${qOld} ${qNew}`;
            const res = await sshPool.runRemoteCommand(server, cmd);
            if (res.exitCode === 44)
                throw new Error('Source not found');
            if (res.exitCode === 46)
                throw new Error('Destination already exists');
            if (res.exitCode !== 0) {
                throw new Error(res.stderr.trim() || `Failed to rename remote item (exit code ${res.exitCode})`);
            }
        }
    }
    async statRemote(server, remotePath) {
        try {
            const sftp = await sshPool.getSftp(server);
            const stat = await new Promise((resolve, reject) => {
                sftp.stat(remotePath, (err, st) => {
                    if (err)
                        reject(err);
                    else
                        resolve(st);
                });
            });
            return {
                isFile: Boolean(stat.isFile?.() ?? ((stat.mode & 0o170000) === 0o100000)),
                isDirectory: Boolean(stat.isDirectory?.() ?? ((stat.mode & 0o170000) === 0o040000)),
                size: Number(stat.size || 0),
            };
        }
        catch {
            const qPath = shellQuotePosix(remotePath);
            const cmd = `if [ ! -e ${qPath} ]; then exit 44; fi; if [ -d ${qPath} ]; then echo "dir:0"; else sz=$(wc -c < ${qPath} | tr -d ' '); echo "file:$sz"; fi`;
            const res = await sshPool.runRemoteCommand(server, cmd);
            if (res.exitCode === 44)
                throw new Error('File or directory not found');
            if (res.exitCode !== 0)
                throw new Error(res.stderr.trim() || 'Failed to stat remote path');
            const out = res.stdout.toString('utf8').trim();
            if (out.startsWith('dir:')) {
                return { isFile: false, isDirectory: true, size: 0 };
            }
            const size = parseInt(out.split(':')[1] || '0', 10) || 0;
            return { isFile: true, isDirectory: false, size };
        }
    }
    async readRemoteBuffer(server, remotePath) {
        try {
            const sftp = await sshPool.getSftp(server);
            return await new Promise((resolve, reject) => {
                sftp.readFile(remotePath, (err, data) => {
                    if (err)
                        reject(err);
                    else
                        resolve(data);
                });
            });
        }
        catch {
            const res = await sshPool.runRemoteCommand(server, `cat -- ${shellQuotePosix(remotePath)}`);
            if (res.exitCode !== 0) {
                throw new Error(res.stderr.trim() || 'Failed to read remote binary file');
            }
            return res.stdout;
        }
    }
    async writeRemoteStream(server, destPath, inputStream) {
        const chunks = [];
        for await (const chunk of inputStream) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        const buf = Buffer.concat(chunks);
        const parentDir = path.posix.dirname(destPath);
        try {
            const sftp = await sshPool.getSftp(server);
            await this.sftpMkdirRecursive(sftp, parentDir);
            await new Promise((resolve, reject) => {
                sftp.writeFile(destPath, buf, (err) => {
                    if (err)
                        reject(err);
                    else
                        resolve();
                });
            });
            return buf.length;
        }
        catch {
            const cmd = `mkdir -p -- ${shellQuotePosix(parentDir)} && cat > ${shellQuotePosix(destPath)}`;
            const res = await sshPool.runRemoteCommand(server, cmd, buf);
            if (res.exitCode !== 0) {
                throw new Error(res.stderr.trim() || 'Failed to upload file to remote server');
            }
            return buf.length;
        }
    }
}
export const fsService = new FsService();
