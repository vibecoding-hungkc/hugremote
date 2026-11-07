import { Client } from 'ssh2';
import { execFileSync, spawn } from 'child_process';
import { EventEmitter } from 'events';
import pty from 'node-pty';
import fs from 'fs';
import path from 'path';
import os from 'os';
const MAX_BUFFER_LENGTH = 100 * 1024;
export function isEncryptedPrivateKeyBuffer(buf) {
    const text = buf.toString('utf8');
    if (/ENCRYPTED/i.test(text))
        return true;
    if (text.includes('BEGIN OPENSSH PRIVATE KEY')) {
        try {
            const base64Body = text
                .replace(/-----BEGIN OPENSSH PRIVATE KEY-----/g, '')
                .replace(/-----END OPENSSH PRIVATE KEY-----/g, '')
                .replace(/\s+/g, '');
            const raw = Buffer.from(base64Body, 'base64');
            const magic = 'openssh-key-v1\0';
            if (raw.subarray(0, magic.length).toString('ascii') === magic) {
                const cipherLen = raw.readUInt32BE(magic.length);
                const cipherName = raw
                    .subarray(magic.length + 4, magic.length + 4 + cipherLen)
                    .toString('ascii');
                if (cipherName && cipherName !== 'none') {
                    return true;
                }
            }
        }
        catch {
            // Ignore parse failure
        }
    }
    return false;
}
function resolveSshAuthSock() {
    if (process.env.SSH_AUTH_SOCK && fs.existsSync(process.env.SSH_AUTH_SOCK)) {
        return process.env.SSH_AUTH_SOCK;
    }
    if (process.platform === 'darwin') {
        try {
            const out = execFileSync('launchctl', ['getenv', 'SSH_AUTH_SOCK'], {
                encoding: 'utf8',
                timeout: 1500,
                stdio: ['ignore', 'pipe', 'ignore'],
            }).trim();
            if (out && fs.existsSync(out)) {
                process.env.SSH_AUTH_SOCK = out;
                return out;
            }
        }
        catch {
            // Ignore if launchctl has no SSH_AUTH_SOCK
        }
    }
    return process.env.SSH_AUTH_SOCK || undefined;
}
function resolveKeyFilePath(rawKeyPath) {
    const trimmed = rawKeyPath.trim().replace(/^['"]|['"]$/g, '');
    if (trimmed.startsWith('~/')) {
        return path.join(os.homedir(), trimmed.slice(2));
    }
    if (trimmed.startsWith('%d/')) {
        return path.join(os.homedir(), trimmed.slice(3));
    }
    if (path.isAbsolute(trimmed)) {
        return trimmed;
    }
    return path.join(os.homedir(), '.ssh', trimmed);
}
function resolveUsablePrivateKey(server) {
    const candidates = [];
    if (server.key) {
        candidates.push(resolveKeyFilePath(server.key));
    }
    const sshDir = path.join(os.homedir(), '.ssh');
    for (const defName of ['id_ed25519', 'id_ecdsa', 'id_rsa', 'id_dsa']) {
        const full = path.join(sshDir, defName);
        if (!candidates.includes(full))
            candidates.push(full);
    }
    for (const filePath of candidates) {
        try {
            if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile())
                continue;
            const buf = fs.readFileSync(filePath);
            if (isEncryptedPrivateKeyBuffer(buf)) {
                // Skip encrypted key buffers when no passphrase is known so ssh2 doesn't throw synchronously;
                // SSH_AUTH_SOCK agent or native ssh fallback will handle passphrase/Keychain keys.
                continue;
            }
            return buf;
        }
        catch {
            // Ignore unreadable key file
        }
    }
    return undefined;
}
function buildNativeSshArgs(server, extraArgs = []) {
    const args = [
        '-o',
        'ServerAliveInterval=15',
        '-o',
        'ServerAliveCountMax=3',
        '-o',
        'StrictHostKeyChecking=no',
    ];
    if (server.key) {
        const resolvedKey = resolveKeyFilePath(server.key);
        if (fs.existsSync(resolvedKey)) {
            args.push('-i', resolvedKey);
        }
    }
    if (server.port && server.port !== 22) {
        args.push('-p', String(server.port));
    }
    const sshConfigPath = path.join(os.homedir(), '.ssh', 'config');
    const hasAliasInConfig = Boolean(server.name) &&
        fs.existsSync(sshConfigPath) &&
        new RegExp(`(^|\\n)\\s*Host\\s+[^\\n]*\\b${server.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(fs.readFileSync(sshConfigPath, 'utf8'));
    if (hasAliasInConfig) {
        args.push(server.name);
    }
    else {
        const target = server.user ? `${server.user}@${server.host}` : server.host;
        args.push(target);
    }
    args.push(...extraArgs);
    return args;
}
class SshConnectionPool {
    clients = new Map();
    connecting = new Map();
    sftpWrappers = new Map();
    testSpawners = null;
    setNativeSshSpawnersForTest(spawners) {
        this.testSpawners = spawners;
    }
    async getClient(server) {
        const existing = this.clients.get(server.id);
        if (existing) {
            return existing;
        }
        const pending = this.connecting.get(server.id);
        if (pending) {
            return pending;
        }
        const connectPromise = new Promise((resolve, reject) => {
            const conn = new Client();
            let settled = false;
            const privateKey = resolveUsablePrivateKey(server);
            const agent = resolveSshAuthSock();
            conn.on('keyboard-interactive', (_name, _instructions, _lang, prompts, finish) => {
                if (server.password && prompts.length > 0) {
                    finish(prompts.map(() => server.password));
                }
                else {
                    finish([]);
                }
            });
            conn.on('ready', () => {
                settled = true;
                this.connecting.delete(server.id);
                this.clients.set(server.id, conn);
                resolve(conn);
            });
            conn.on('error', (err) => {
                this.connecting.delete(server.id);
                this.clients.delete(server.id);
                this.sftpWrappers.delete(server.id);
                if (!settled) {
                    settled = true;
                    reject(err);
                }
            });
            conn.on('close', () => {
                this.connecting.delete(server.id);
                this.clients.delete(server.id);
                this.sftpWrappers.delete(server.id);
                if (!settled) {
                    settled = true;
                    reject(new Error('SSH connection closed before ready'));
                }
            });
            try {
                conn.connect({
                    host: server.host,
                    port: server.port || 22,
                    username: server.user || os.userInfo().username || 'root',
                    privateKey,
                    password: server.password,
                    agent,
                    tryKeyboard: Boolean(server.password),
                    readyTimeout: 15000,
                    keepaliveInterval: 10000,
                });
            }
            catch (syncErr) {
                this.connecting.delete(server.id);
                if (!settled) {
                    settled = true;
                    reject(syncErr);
                }
            }
        });
        this.connecting.set(server.id, connectPromise);
        return connectPromise;
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
    spawnNativeSshExec(server, command, options) {
        if (this.testSpawners?.spawnExec) {
            return this.testSpawners.spawnExec(server, command, options);
        }
        const sshBin = fs.existsSync('/usr/bin/ssh') ? '/usr/bin/ssh' : 'ssh';
        const sshArgs = buildNativeSshArgs(server, ['-o', 'BatchMode=yes', command]);
        const child = spawn(sshBin, sshArgs, {
            env: {
                ...process.env,
                ...(options?.env || {}),
            },
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        const channelEmitter = new EventEmitter();
        channelEmitter.stderr = new EventEmitter();
        channelEmitter.write = (data) => child.stdin?.write(data);
        channelEmitter.end = () => child.stdin?.end();
        channelEmitter.close = () => {
            try {
                child.kill('SIGTERM');
            }
            catch { }
        };
        channelEmitter.signal = (sig) => {
            try {
                child.kill((sig ? `SIG${sig.replace(/^SIG/, '')}` : 'SIGTERM'));
            }
            catch { }
        };
        child.stdout?.on('data', (chunk) => channelEmitter.emit('data', chunk));
        child.stderr?.on('data', (chunk) => channelEmitter.stderr.emit('data', chunk));
        child.on('error', (err) => channelEmitter.emit('error', err));
        child.on('exit', (code, signal) => channelEmitter.emit('exit', code, signal || undefined));
        child.on('close', (code, signal) => channelEmitter.emit('close', code ?? undefined, signal || undefined));
        return channelEmitter;
    }
    spawnNativeSshPty(sessionInfo, server) {
        const sshArgs = buildNativeSshArgs(server, ['-tt']);
        if (this.testSpawners?.spawnPty) {
            return this.testSpawners.spawnPty(sessionInfo, server, sshArgs);
        }
        const sshBin = fs.existsSync('/usr/bin/ssh') ? '/usr/bin/ssh' : 'ssh';
        const cols = Math.max(10, sessionInfo.cols || 80);
        const rows = Math.max(5, sessionInfo.rows || 24);
        const ptyProcess = pty.spawn(sshBin, sshArgs, {
            name: 'xterm-256color',
            cols,
            rows,
            cwd: os.homedir(),
            env: {
                ...process.env,
                TERM: 'xterm-256color',
                COLORTERM: 'truecolor',
            },
        });
        if (sessionInfo.cwd) {
            setTimeout(() => {
                try {
                    ptyProcess.write(`cd "${sessionInfo.cwd}" && clear\r`);
                }
                catch { }
            }, 350);
        }
        let buffer = '';
        const dataCallbacks = [];
        const exitCallbacks = [];
        ptyProcess.onData((data) => {
            buffer += data;
            if (buffer.length > MAX_BUFFER_LENGTH) {
                buffer = buffer.substring(buffer.length - MAX_BUFFER_LENGTH);
            }
            for (const cb of dataCallbacks)
                cb(data);
        });
        ptyProcess.onExit(() => {
            for (const cb of exitCallbacks)
                cb();
        });
        return {
            id: sessionInfo.id,
            name: sessionInfo.name,
            serverId: sessionInfo.serverId,
            get buffer() {
                return buffer;
            },
            stream: {},
            write(data) {
                try {
                    ptyProcess.write(data);
                }
                catch { }
            },
            resize(newCols, newRows) {
                try {
                    ptyProcess.resize(Math.max(10, newCols), Math.max(5, newRows));
                }
                catch { }
            },
            kill() {
                try {
                    ptyProcess.kill();
                }
                catch { }
            },
            onData(cb) {
                dataCallbacks.push(cb);
            },
            onExit(cb) {
                exitCallbacks.push(cb);
            },
        };
    }
    async executeCommand(server, command, options) {
        try {
            const client = await this.getClient(server);
            return await new Promise((resolve, reject) => {
                client.exec(command, options || {}, (err, stream) => {
                    if (err)
                        return reject(err);
                    resolve(stream);
                });
            });
        }
        catch {
            return this.spawnNativeSshExec(server, command, options);
        }
    }
    async createShell(sessionInfo, server) {
        try {
            const client = await this.getClient(server);
            return await new Promise((resolve, reject) => {
                client.shell({
                    term: 'xterm-256color',
                    cols: Math.max(10, sessionInfo.cols || 80),
                    rows: Math.max(5, sessionInfo.rows || 24),
                }, (err, stream) => {
                    if (err)
                        return reject(err);
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
        catch {
            return this.spawnNativeSshPty(sessionInfo, server);
        }
    }
    disconnect(serverId) {
        this.connecting.delete(serverId);
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
