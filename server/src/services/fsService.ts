import fs from 'fs';
import path from 'path';
import { LOCAL_WORKSPACE, ALLOWED_ROOT, ServerConfig } from '../config.js';
import { sshPool } from './sshPool.js';

export interface FileEntry {
  name: string;
  isDirectory: boolean;
  size: number;
  mtime: string | null;
  ext: string;
  relPath: string;
}

export class FsService {
  private resolveLocalPath(requestedPath: string, workspaceOverride?: string): string {
    const base = workspaceOverride || LOCAL_WORKSPACE;
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
    } else {
      const isAllowed = target === canonicalRoot || target.startsWith(rootWithSep);
      if (!isAllowed) {
        throw new Error('Access denied: Path is outside permitted root');
      }
    }

    return target;
  }

  // --- LOCAL FS ---
  async listLocal(relPath = '', workspaceOverride?: string): Promise<{ currentRel: string; parentRel: string | null; entries: FileEntry[] }> {
    const base = workspaceOverride || LOCAL_WORKSPACE;
    const targetDir = this.resolveLocalPath(relPath, base);
    if (!fs.existsSync(targetDir)) {
      throw new Error('Directory does not exist');
    }

    const dirents = fs.readdirSync(targetDir, { withFileTypes: true });
    const entries: FileEntry[] = dirents
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
        } catch (_) {}

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
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
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

  async readLocalFile(relPath: string, workspaceOverride?: string): Promise<{ name: string; size: number; content: string }> {
    const filePath = this.resolveLocalPath(relPath, workspaceOverride);
    if (!fs.existsSync(filePath)) throw new Error('File not found');

    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) throw new Error('Path is a directory, not a file');
    if (stat.size > 10 * 1024 * 1024) throw new Error('File too large (> 10MB)');

    const content = fs.readFileSync(filePath, 'utf8');
    return {
      name: path.basename(filePath),
      size: stat.size,
      content,
    };
  }

  async writeLocalFile(relPath: string, content: string, workspaceOverride?: string): Promise<{ size: number }> {
    const filePath = this.resolveLocalPath(relPath, workspaceOverride);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    fs.writeFileSync(filePath, content || '', 'utf8');
    const stat = fs.statSync(filePath);
    return { size: stat.size };
  }

  async createLocal(relPath: string, type: 'file' | 'dir', workspaceOverride?: string): Promise<void> {
    const target = this.resolveLocalPath(relPath, workspaceOverride);
    if (fs.existsSync(target)) throw new Error('Item already exists');

    if (type === 'dir') {
      fs.mkdirSync(target, { recursive: true });
    } else {
      const dir = path.dirname(target);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(target, '', 'utf8');
    }
  }

  async deleteLocal(relPath: string, workspaceOverride?: string): Promise<void> {
    const base = workspaceOverride || LOCAL_WORKSPACE;
    const target = this.resolveLocalPath(relPath, workspaceOverride);
    if (target === ALLOWED_ROOT || target === base) {
      throw new Error('Cannot delete root workspace');
    }
    if (!fs.existsSync(target)) throw new Error('Target not found');
    fs.rmSync(target, { recursive: true, force: true });
  }

  async renameLocal(oldRel: string, newRel: string, workspaceOverride?: string): Promise<void> {
    const oldTarget = this.resolveLocalPath(oldRel, workspaceOverride);
    const newTarget = this.resolveLocalPath(newRel, workspaceOverride);
    if (!fs.existsSync(oldTarget)) throw new Error('Source not found');
    if (fs.existsSync(newTarget)) throw new Error('Destination already exists');
    fs.renameSync(oldTarget, newTarget);
  }

  // --- REMOTE SFTP FS ---
  async listRemote(server: ServerConfig, dirPath = ''): Promise<{ currentRel: string; parentRel: string | null; entries: FileEntry[] }> {
    const sftp = await sshPool.getSftp(server);
    const targetDir = dirPath || server.workspace || '/root';

    return new Promise((resolve, reject) => {
      sftp.readdir(targetDir, (err, list) => {
        if (err) return reject(err);

        const entries: FileEntry[] = list
          .filter((e) => !e.filename.startsWith('.git') && e.filename !== 'node_modules')
          .map((e) => {
            const isDir = (e.attrs.mode & 0o170000) === 0o040000;
            return {
              name: e.filename,
              isDirectory: isDir,
              size: e.attrs.size || 0,
              mtime: new Date(e.attrs.mtime * 1000).toISOString(),
              ext: isDir ? '' : path.extname(e.filename).toLowerCase(),
              relPath: path.posix.join(targetDir, e.filename),
            };
          })
          .sort((a, b) => {
            if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
            return a.name.localeCompare(b.name);
          });

        const parentRel = targetDir === '/' ? null : path.posix.dirname(targetDir);

        resolve({
          currentRel: targetDir,
          parentRel,
          entries,
        });
      });
    });
  }

  async readRemoteFile(server: ServerConfig, filePath: string): Promise<{ name: string; size: number; content: string }> {
    const sftp = await sshPool.getSftp(server);
    return new Promise((resolve, reject) => {
      sftp.readFile(filePath, (err, data) => {
        if (err) return reject(err);
        const content = data.toString('utf8');
        resolve({
          name: path.posix.basename(filePath),
          size: Buffer.byteLength(content, 'utf8'),
          content,
        });
      });
    });
  }

  async writeRemoteFile(server: ServerConfig, filePath: string, content: string): Promise<{ size: number }> {
    const sftp = await sshPool.getSftp(server);
    return new Promise((resolve, reject) => {
      sftp.writeFile(filePath, content, 'utf8', (err) => {
        if (err) return reject(err);
        resolve({ size: Buffer.byteLength(content, 'utf8') });
      });
    });
  }
}

export const fsService = new FsService();
