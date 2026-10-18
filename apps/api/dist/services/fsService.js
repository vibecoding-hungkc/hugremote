import fs from 'fs';
import path from 'path';
import { LOCAL_WORKSPACE, ALLOWED_ROOT } from '../config.js';
import { sshPool } from './sshPool.js';
export class FsService {
    resolveLocalPath(requestedPath, workspaceOverride) {
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
        // If target exists, dereference symlinks to inspect real destination
        if (fs.existsSync(target)) {
            const canonicalTarget = fs.realpathSync(target);
            const isAllowed = canonicalTarget === canonicalRoot || canonicalTarget.startsWith(rootWithSep);
            if (!isAllowed) {
                throw new Error('Access denied: Path resolves outside permitted root (symlink escape detected)');
            }
            return canonicalTarget;
        }
        // If target does not exist yet (e.g. creating a new file/dir), verify parent directory
        const parentDir = path.dirname(target);
        if (fs.existsSync(parentDir)) {
            const canonicalParent = fs.realpathSync(parentDir);
            const isAllowed = canonicalParent === canonicalRoot || canonicalParent.startsWith(rootWithSep);
            if (!isAllowed) {
                throw new Error('Access denied: Parent directory resolves outside permitted root');
            }
        }
        else {
            const isAllowed = target === canonicalRoot || target.startsWith(rootWithSep);
            if (!isAllowed) {
                throw new Error('Access denied: Path is outside permitted root');
            }
        }
        return target;
    }
    // --- LOCAL FS ---
    async listLocal(relPath = '', workspaceOverride) {
        let base = workspaceOverride || LOCAL_WORKSPACE;
        if (!fs.existsSync(base)) {
            try {
                fs.mkdirSync(base, { recursive: true });
            }
            catch (_) { }
        }
        const targetDir = this.resolveLocalPath(relPath, base);
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
        const parentDir = targetDir === ALLOWED_ROOT ? null : path.dirname(targetDir);
        const parentRel = parentDir ? path.relative(base, parentDir) : null;
        return {
            currentRel: path.relative(base, targetDir),
            parentRel,
            entries,
        };
    }
    async readLocalFile(relPath, workspaceOverride) {
        const filePath = this.resolveLocalPath(relPath, workspaceOverride);
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
    async writeLocalFile(relPath, content, workspaceOverride) {
        const filePath = this.resolveLocalPath(relPath, workspaceOverride);
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir))
            fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(filePath, content || '', 'utf8');
        const stat = fs.statSync(filePath);
        return { size: stat.size };
    }
    async createLocal(relPath, type, workspaceOverride) {
        const target = this.resolveLocalPath(relPath, workspaceOverride);
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
    async deleteLocal(relPath, workspaceOverride) {
        const base = workspaceOverride || LOCAL_WORKSPACE;
        const target = this.resolveLocalPath(relPath, workspaceOverride);
        if (target === ALLOWED_ROOT || target === base) {
            throw new Error('Cannot delete root workspace');
        }
        if (!fs.existsSync(target))
            throw new Error('Target not found');
        fs.rmSync(target, { recursive: true, force: true });
    }
    async renameLocal(oldRel, newRel, workspaceOverride) {
        const oldTarget = this.resolveLocalPath(oldRel, workspaceOverride);
        const newTarget = this.resolveLocalPath(newRel, workspaceOverride);
        if (!fs.existsSync(oldTarget))
            throw new Error('Source not found');
        if (fs.existsSync(newTarget))
            throw new Error('Destination already exists');
        fs.renameSync(oldTarget, newTarget);
    }
    // --- REMOTE SFTP FS ---
    resolveRemotePath(server, requestedPath = '', workspaceOverride) {
        const home = server.user && server.user !== 'root' ? `/home/${server.user}` : '/root';
        const rawBase = workspaceOverride || server.workspace || home;
        let base = rawBase;
        if (base === '~') {
            base = home;
        }
        else if (base.startsWith('~/')) {
            base = path.posix.join(home, base.slice(2));
        }
        if (!requestedPath || requestedPath === '.')
            return base;
        if (path.posix.isAbsolute(requestedPath))
            return path.posix.normalize(requestedPath);
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
        const sftp = await sshPool.getSftp(server);
        const base = this.resolveRemotePath(server, '', workspaceOverride);
        const targetDir = this.resolveRemotePath(server, dirPath, workspaceOverride);
        return new Promise((resolve, reject) => {
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
                const parentRel = targetDir === '/' || targetDir === base ? null : path.posix.relative(base, path.posix.dirname(targetDir));
                resolve({
                    currentRel: path.posix.relative(base, targetDir),
                    parentRel,
                    entries,
                });
            });
        });
    }
    async readRemoteFile(server, filePath, workspaceOverride) {
        const sftp = await sshPool.getSftp(server);
        const targetPath = this.resolveRemotePath(server, filePath, workspaceOverride);
        return new Promise((resolve, reject) => {
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
    async writeRemoteFile(server, filePath, content, workspaceOverride) {
        const sftp = await sshPool.getSftp(server);
        const targetPath = this.resolveRemotePath(server, filePath, workspaceOverride);
        const parentDir = path.posix.dirname(targetPath);
        await this.sftpMkdirRecursive(sftp, parentDir);
        return new Promise((resolve, reject) => {
            sftp.writeFile(targetPath, content || '', 'utf8', (err) => {
                if (err)
                    return reject(err);
                resolve({ size: Buffer.byteLength(content || '', 'utf8') });
            });
        });
    }
    async createRemote(server, relPath, type, workspaceOverride) {
        const sftp = await sshPool.getSftp(server);
        const target = this.resolveRemotePath(server, relPath, workspaceOverride);
        // Check if target already exists
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
    async deleteRemote(server, relPath, workspaceOverride) {
        const sftp = await sshPool.getSftp(server);
        const base = this.resolveRemotePath(server, '', workspaceOverride);
        const target = this.resolveRemotePath(server, relPath, workspaceOverride);
        if (target === '/' || target === base) {
            throw new Error('Cannot delete root workspace');
        }
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
    async renameRemote(server, oldRel, newRel, workspaceOverride) {
        const sftp = await sshPool.getSftp(server);
        const oldTarget = this.resolveRemotePath(server, oldRel, workspaceOverride);
        const newTarget = this.resolveRemotePath(server, newRel, workspaceOverride);
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
        return new Promise((resolve, reject) => {
            sftp.rename(oldTarget, newTarget, (err) => {
                if (err)
                    return reject(err);
                resolve();
            });
        });
    }
}
export const fsService = new FsService();
