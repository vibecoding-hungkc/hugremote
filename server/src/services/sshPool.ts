import { Client, ClientChannel, SFTPWrapper } from 'ssh2';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { ServerConfig } from '../config.js';

export interface RemotePtyInstance {
  id: string;
  name: string;
  serverId: string;
  buffer: string;
  stream: ClientChannel;
  write: (data: string) => void;
  resize: (cols: number, rows: number) => void;
  kill: () => void;
  onData: (callback: (data: string) => void) => void;
  onExit: (callback: () => void) => void;
}

const MAX_BUFFER_LENGTH = 100 * 1024;

class SshConnectionPool {
  private clients = new Map<string, Client>();
  private sftpWrappers = new Map<string, SFTPWrapper>();

  async getClient(server: ServerConfig): Promise<Client> {
    const existing = this.clients.get(server.id);
    if (existing) {
      return existing;
    }

    return new Promise((resolve, reject) => {
      const conn = new Client();

      let privateKey: Buffer | undefined;
      if (server.key) {
        const keyPath = server.key.startsWith('~')
          ? path.join(os.homedir(), server.key.slice(1))
          : server.key;
        if (fs.existsSync(keyPath)) {
          privateKey = fs.readFileSync(keyPath);
        }
      }

      conn.on('ready', () => {
        this.clients.set(server.id, conn);
        resolve(conn);
      });

      conn.on('error', (err) => {
        this.clients.delete(server.id);
        this.sftpWrappers.delete(server.id);
        reject(err);
      });

      conn.on('close', () => {
        this.clients.delete(server.id);
        this.sftpWrappers.delete(server.id);
      });

      conn.connect({
        host: server.host,
        port: server.port || 22,
        username: server.user || 'root',
        privateKey,
        password: server.password,
        readyTimeout: 15000,
        keepaliveInterval: 10000,
      });
    });
  }

  async getSftp(server: ServerConfig): Promise<SFTPWrapper> {
    const existing = this.sftpWrappers.get(server.id);
    if (existing) return existing;

    const client = await this.getClient(server);
    return new Promise((resolve, reject) => {
      client.sftp((err, sftp) => {
        if (err) return reject(err);
        this.sftpWrappers.set(server.id, sftp);
        resolve(sftp);
      });
    });
  }

  async createShell(
    sessionInfo: { id: string; name: string; serverId: string; cols?: number; rows?: number; cwd?: string },
    server: ServerConfig
  ): Promise<RemotePtyInstance> {
    const client = await this.getClient(server);

    return new Promise((resolve, reject) => {
      client.shell(
        {
          term: 'xterm-256color',
          cols: Math.max(10, sessionInfo.cols || 80),
          rows: Math.max(5, sessionInfo.rows || 24),
        },
        (err, stream) => {
          if (err) return reject(err);

          // If target directory is specified, cd into it on initial connection
          if (sessionInfo.cwd) {
            setTimeout(() => {
              try {
                stream.write(`cd "${sessionInfo.cwd}" && clear\r`);
              } catch (_) {}
            }, 100);
          }

          let buffer = '';
          const dataCallbacks: Array<(data: string) => void> = [];
          const exitCallbacks: Array<() => void> = [];

          stream.on('data', (chunk: Buffer) => {
            const str = chunk.toString('utf8');
            buffer += str;
            if (buffer.length > MAX_BUFFER_LENGTH) {
              buffer = buffer.substring(buffer.length - MAX_BUFFER_LENGTH);
            }
            for (const cb of dataCallbacks) cb(str);
          });

          stream.on('close', () => {
            for (const cb of exitCallbacks) cb();
          });

          const instance: RemotePtyInstance = {
            id: sessionInfo.id,
            name: sessionInfo.name,
            serverId: sessionInfo.serverId,
            get buffer() {
              return buffer;
            },
            stream,
            write(data: string) {
              try {
                stream.write(data);
              } catch (_) {}
            },
            resize(cols: number, rows: number) {
              try {
                stream.setWindow(Math.max(5, rows), Math.max(10, cols), 0, 0);
              } catch (_) {}
            },
            kill() {
              try {
                stream.close();
              } catch (_) {}
            },
            onData(cb) {
              dataCallbacks.push(cb);
            },
            onExit(cb) {
              exitCallbacks.push(cb);
            },
          };

          resolve(instance);
        }
      );
    });
  }

  disconnect(serverId: string) {
    const client = this.clients.get(serverId);
    if (client) {
      try {
        client.end();
      } catch (_) {}
      this.clients.delete(serverId);
      this.sftpWrappers.delete(serverId);
    }
  }

  isServerConnected(serverId: string): boolean {
    return this.clients.has(serverId);
  }
}

export const sshPool = new SshConnectionPool();
