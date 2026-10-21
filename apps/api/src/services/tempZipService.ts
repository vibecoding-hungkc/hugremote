import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { spawn } from 'child_process';
import { ServerConfig } from '../config.js';
import { sshPool } from './sshPool.js';

export interface TempZipArchiveItem {
  id: string;
  name: string;
  folderName: string;
  filePath: string;
  size: number;
  sizeStr: string;
  mtime: number;
  expiresAt: number;
}

const DEFAULT_TTL_MS = 60 * 60 * 1000; // 60 minutes
const MAX_TOTAL_BYTES = 500 * 1024 * 1024; // 500 MB
const CLEANUP_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

export class TempZipService {
  private tempDir: string;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.tempDir = this.resolveTempDir();
    this.startAutoCleanup();
  }

  public resolveTempDir(): string {
    const base = process.env.DATA_DIR || path.join(os.homedir(), '.config', 'hugremote');
    const target = path.join(base, 'tmp', 'downloads');
    try {
      fs.mkdirSync(target, { recursive: true });
    } catch (_) {}
    return target;
  }

  public getTempDir(): string {
    return this.tempDir;
  }

  public formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  /**
   * Zip a local directory using python3 -m zipfile.
   * Runs from cwd = parent directory so paths inside the archive remain relative.
   */
  public async createLocalZip(sourceDir: string, folderName: string): Promise<{ zipPath: string; fileName: string; size: number; sizeStr: string }> {
    if (!fs.existsSync(sourceDir)) {
      throw new Error(`Directory not found: ${sourceDir}`);
    }
    const stat = fs.statSync(sourceDir);
    if (!stat.isDirectory()) {
      throw new Error(`Target is not a directory: ${sourceDir}`);
    }

    const cleanFolder = (folderName || path.basename(sourceDir) || 'archive').replace(/[^a-zA-Z0-9_.-]/g, '_');
    const dateStr = new Date().toISOString().slice(0, 10);
    const hash = crypto.randomBytes(3).toString('hex');
    const fileName = `${cleanFolder}-${dateStr}-${hash}.zip`;
    const zipPath = path.join(this.tempDir, fileName);

    const parentDir = path.dirname(sourceDir);
    const baseDirName = path.basename(sourceDir);

    await new Promise<void>((resolve, reject) => {
      const proc = spawn('python3', ['-m', 'zipfile', '-c', zipPath, baseDirName], {
        cwd: parentDir,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stderr = '';
      proc.stderr.on('data', (d) => (stderr += d.toString('utf8')));
      proc.on('close', (code) => {
        if (code === 0 && fs.existsSync(zipPath)) {
          resolve();
        } else {
          reject(new Error(`Failed to zip directory (exit code ${code}): ${stderr || 'Unknown error'}`));
        }
      });
      proc.on('error', (err) => reject(err));
    });

    const zipStat = fs.statSync(zipPath);
    return {
      zipPath,
      fileName,
      size: zipStat.size,
      sizeStr: this.formatBytes(zipStat.size),
    };
  }

  /**
   * Zip a remote directory over SSH, download the zip to the local temp directory, and cleanup remote temp zip.
   */
  public async createRemoteZip(server: ServerConfig, remoteDir: string, folderName: string): Promise<{ zipPath: string; fileName: string; size: number; sizeStr: string }> {
    const cleanFolder = (folderName || path.posix.basename(remoteDir) || 'archive').replace(/[^a-zA-Z0-9_.-]/g, '_');
    const dateStr = new Date().toISOString().slice(0, 10);
    const hash = crypto.randomBytes(3).toString('hex');
    const fileName = `${cleanFolder}-${dateStr}-${hash}.zip`;
    const zipPath = path.join(this.tempDir, fileName);

    const remoteParent = path.posix.dirname(remoteDir);
    const remoteBase = path.posix.basename(remoteDir);
    const remoteTmpZip = `/tmp/hugremote_${hash}.zip`;

    // Command to zip remotely
    const zipCmd = `cd "${remoteParent}" && python3 -m zipfile -c "${remoteTmpZip}" "${remoteBase}" 2>/dev/null || (which zip >/dev/null && cd "${remoteParent}" && zip -rq "${remoteTmpZip}" "${remoteBase}")`;
    const stream = await sshPool.executeCommand(server, zipCmd);
    await new Promise<void>((resolve, reject) => {
      stream.on('close', resolve);
      stream.on('error', reject);
    });

    // Stream download remoteTmpZip via SFTP to local zipPath
    const sftp = await sshPool.getSftp(server);
    await new Promise<void>((resolve, reject) => {
      sftp.fastGet(remoteTmpZip, zipPath, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Clean up remote temporary file in background
    sshPool.executeCommand(server, `rm -f "${remoteTmpZip}"`).catch(() => {});

    const zipStat = fs.statSync(zipPath);
    return {
      zipPath,
      fileName,
      size: zipStat.size,
      sizeStr: this.formatBytes(zipStat.size),
    };
  }

  /**
   * List all current temporary zip archives in ~/.config/hugremote/tmp/downloads/
   */
  public listArchives(): TempZipArchiveItem[] {
    try {
      if (!fs.existsSync(this.tempDir)) return [];
      const files = fs.readdirSync(this.tempDir);
      const items: TempZipArchiveItem[] = [];

      for (const file of files) {
        if (!file.endsWith('.zip')) continue;
        const filePath = path.join(this.tempDir, file);
        try {
          const stat = fs.statSync(filePath);
          const mtime = stat.mtimeMs;
          const expiresAt = mtime + DEFAULT_TTL_MS;
          // Extract folder name from fileName: <folderName>-<date>-<hash>.zip
          const parts = file.split('-');
          const folderName = parts.length > 2 ? parts.slice(0, -2).join('-') : file.replace(/\.zip$/, '');

          items.push({
            id: file,
            name: file,
            folderName,
            filePath,
            size: stat.size,
            sizeStr: this.formatBytes(stat.size),
            mtime,
            expiresAt,
          });
        } catch (_) {}
      }

      return items.sort((a, b) => b.mtime - a.mtime);
    } catch (_) {
      return [];
    }
  }

  /**
   * Delete a specific temporary zip archive by fileName
   */
  public deleteArchive(fileName: string): boolean {
    const safeName = path.basename(fileName);
    const target = path.join(this.tempDir, safeName);
    if (fs.existsSync(target) && target.endsWith('.zip')) {
      try {
        fs.unlinkSync(target);
        return true;
      } catch (_) {}
    }
    return false;
  }

  /**
   * Purge all temporary zip archives
   */
  public purgeAll(): { count: number; freedBytes: number } {
    let count = 0;
    let freedBytes = 0;
    const archives = this.listArchives();
    for (const arch of archives) {
      try {
        fs.unlinkSync(arch.filePath);
        count++;
        freedBytes += arch.size;
      } catch (_) {}
    }
    return { count, freedBytes };
  }

  /**
   * Automatic cleanup daemon: removes files older than TTL (60 mins)
   * and enforces total LRU quota (500 MB).
   */
  public cleanupOldZipArchives(ttlMs = DEFAULT_TTL_MS, maxTotalBytes = MAX_TOTAL_BYTES): { removedCount: number; freedBytes: number } {
    let removedCount = 0;
    let freedBytes = 0;
    const now = Date.now();
    const archives = this.listArchives(); // sorted newest first

    // 1. Remove expired files
    const remaining: TempZipArchiveItem[] = [];
    for (const arch of archives) {
      if (now - arch.mtime > ttlMs) {
        try {
          fs.unlinkSync(arch.filePath);
          removedCount++;
          freedBytes += arch.size;
        } catch (_) {}
      } else {
        remaining.push(arch);
      }
    }

    // 2. Enforce maxTotalBytes (delete oldest first)
    remaining.reverse(); // oldest first
    let currentTotal = remaining.reduce((sum, item) => sum + item.size, 0);

    for (const arch of remaining) {
      if (currentTotal <= maxTotalBytes) break;
      try {
        fs.unlinkSync(arch.filePath);
        removedCount++;
        freedBytes += arch.size;
        currentTotal -= arch.size;
      } catch (_) {}
    }

    return { removedCount, freedBytes };
  }

  public startAutoCleanup(): void {
    if (this.cleanupTimer) return;
    this.cleanupTimer = setInterval(() => {
      try {
        this.cleanupOldZipArchives();
      } catch (err) {
        console.warn('[TempZipService] Cleanup error:', err);
      }
    }, CLEANUP_INTERVAL_MS);

    // unref so timer doesn't keep node process alive on shutdown
    if (this.cleanupTimer && typeof this.cleanupTimer.unref === 'function') {
      this.cleanupTimer.unref();
    }
  }

  public stopAutoCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }
}

export const tempZipService = new TempZipService();
