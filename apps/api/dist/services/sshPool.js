import { Client } from 'ssh2';
import fs from 'fs';
import path from 'path';
import os from 'os';
const MAX_BUFFER_LENGTH = 100 * 1024;
class SshConnectionPool {
    clients = new Map();
    sftpWrappers = new Map();
    async getClient(server) {
        const existing = this.clients.get(server.id);
        if (existing) {
            return existing;
        }
        return new Promise((resolve, reject) => {
            const conn = new Client();
            let privateKey;
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
    async getSftp(server) {
        const existing = this.sftpWrappers.get(server.id);
        if (existing)
            return existing;
        const client = await this.getClient(server);
        return new Promise((resolve, reject) => {
            client.sftp((err, sftp) => {
                if (err)
                    return reject(err);
                this.sftpWrappers.set(server.id, sftp);
                resolve(sftp);
            });
        });
    }
    async executeCommand(server, command, options) {
        const client = await this.getClient(server);
        return new Promise((resolve, reject) => {
            client.exec(command, options || {}, (err, stream) => {
                if (err)
                    return reject(err);
                resolve(stream);
            });
        });
    }
    async createShell(sessionInfo, server) {
        const client = await this.getClient(server);
        return new Promise((resolve, reject) => {
            client.shell({
                term: 'xterm-256color',
                cols: Math.max(10, sessionInfo.cols || 80),
                rows: Math.max(5, sessionInfo.rows || 24),
            }, (err, stream) => {
                if (err)
                    return reject(err);
                // If target directory is specified, cd into it on initial connection
                if (sessionInfo.cwd) {
                    setTimeout(() => {
                        try {
                            stream.write(`cd "${sessionInfo.cwd}" && clear\r`);
                        }
                        catch (_) { }
                    }, 100);
                }
                let buffer = '';
                const dataCallbacks = [];
                const exitCallbacks = [];
                stream.on('data', (chunk) => {
                    const str = chunk.toString('utf8');
                    buffer += str;
                    if (buffer.length > MAX_BUFFER_LENGTH) {
                        buffer = buffer.substring(buffer.length - MAX_BUFFER_LENGTH);
                    }
                    for (const cb of dataCallbacks)
                        cb(str);
                });
                stream.on('close', () => {
                    for (const cb of exitCallbacks)
                        cb();
                });
                const instance = {
                    id: sessionInfo.id,
                    name: sessionInfo.name,
                    serverId: sessionInfo.serverId,
                    get buffer() {
                        return buffer;
                    },
                    stream,
                    write(data) {
                        try {
                            stream.write(data);
                        }
                        catch (_) { }
                    },
                    resize(cols, rows) {
                        try {
                            stream.setWindow(Math.max(5, rows), Math.max(10, cols), 0, 0);
                        }
                        catch (_) { }
                    },
                    kill() {
                        try {
                            stream.close();
                        }
                        catch (_) { }
                    },
                    onData(cb) {
                        dataCallbacks.push(cb);
                    },
                    onExit(cb) {
                        exitCallbacks.push(cb);
                    },
                };
                resolve(instance);
            });
        });
    }
    disconnect(serverId) {
        const client = this.clients.get(serverId);
        if (client) {
            try {
                client.end();
            }
            catch (_) { }
            this.clients.delete(serverId);
            this.sftpWrappers.delete(serverId);
        }
    }
    isServerConnected(serverId) {
        return this.clients.has(serverId);
    }
}
export const sshPool = new SshConnectionPool();
