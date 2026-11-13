import { Client } from 'ssh2';
import { execFileSync, spawn } from 'child_process';
import { EventEmitter } from 'events';
import { Duplex } from 'stream';
import pty from 'node-pty';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { hasSshHostAlias, sanitizeRemoteWorkspacePath, } from '../config.js';
const MAX_BUFFER_LENGTH = 500 * 1024;
const NATIVE_FALLBACK_TTL_MS = 2 * 60 * 1000;
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
let cachedLoginShellEnv = null;
function resolveLoginShellEnv() {
    if (cachedLoginShellEnv !== null)
        return cachedLoginShellEnv;
    cachedLoginShellEnv = {};
    if (process.platform !== 'darwin')
        return cachedLoginShellEnv;
    try {
        const userShell = process.env.SHELL || '/bin/zsh';
        const out = execFileSync(userShell, [
            '-lic',
            'printf "__HUG_ENV_START__%s__HUG_SEP__%s__HUG_ENV_END__" "$PATH" "$SSH_AUTH_SOCK"',
        ], {
            encoding: 'utf8',
            timeout: 2000,
            stdio: ['ignore', 'pipe', 'ignore'],
        });
        const match = out.match(/__HUG_ENV_START__([\s\S]*?)__HUG_SEP__([\s\S]*?)__HUG_ENV_END__/);
        if (match) {
            if (match[1] && match[1].trim()) {
                cachedLoginShellEnv.PATH = match[1].trim();
            }
            if (match[2] && match[2].trim() && fs.existsSync(match[2].trim())) {
                cachedLoginShellEnv.SSH_AUTH_SOCK = match[2].trim();
            }
        }
    }
    catch {
        // Ignore shell probe failure
    }
    return cachedLoginShellEnv;
}
let macKeychainLoaded = false;
function ensureMacKeychainKeysLoaded(authSock) {
    if (process.platform !== 'darwin' || macKeychainLoaded)
        return;
    macKeychainLoaded = true;
    try {
        execFileSync('/usr/bin/ssh-add', ['--apple-load-keychain'], {
            timeout: 1500,
            env: {
                ...process.env,
                ...(authSock ? { SSH_AUTH_SOCK: authSock } : {}),
            },
            stdio: ['ignore', 'ignore', 'ignore'],
        });
    }
    catch {
        // Ignore if no keys are stored in Apple Keychain
    }
}
function resolveSshAuthSock(customAgentPath, homeDir = os.homedir()) {
    if (customAgentPath && customAgentPath.toLowerCase() !== 'none') {
        const resolvedCustom = resolveKeyFilePath(customAgentPath, homeDir);
        if (fs.existsSync(resolvedCustom)) {
            return resolvedCustom;
        }
    }
    if (process.platform === 'darwin') {
        const shellEnv = resolveLoginShellEnv();
        if (shellEnv.SSH_AUTH_SOCK && fs.existsSync(shellEnv.SSH_AUTH_SOCK)) {
            process.env.SSH_AUTH_SOCK = shellEnv.SSH_AUTH_SOCK;
            ensureMacKeychainKeysLoaded(shellEnv.SSH_AUTH_SOCK);
            return shellEnv.SSH_AUTH_SOCK;
        }
    }
    if (process.env.SSH_AUTH_SOCK && fs.existsSync(process.env.SSH_AUTH_SOCK)) {
        ensureMacKeychainKeysLoaded(process.env.SSH_AUTH_SOCK);
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
                ensureMacKeychainKeysLoaded(out);
                return out;
            }
        }
        catch {
            // Ignore if launchctl has no SSH_AUTH_SOCK
        }
    }
    return process.env.SSH_AUTH_SOCK || undefined;
}
function resolveEnhancedPath() {
    const home = os.homedir();
    const standardDirs = [
        path.join(home, '.local', 'bin'),
        path.join(home, '.orbstack', 'bin'),
        path.join(home, '.rd', 'bin'),
        '/opt/homebrew/bin',
        '/opt/homebrew/sbin',
        '/usr/local/bin',
        '/usr/local/sbin',
        '/opt/local/bin',
        '/usr/bin',
        '/bin',
        '/usr/sbin',
        '/sbin',
    ];
    const shellEnv = resolveLoginShellEnv();
    const parts = [
        ...(shellEnv.PATH ? shellEnv.PATH.split(':') : []),
        ...standardDirs,
        ...(process.env.PATH ? process.env.PATH.split(':') : []),
    ].filter(Boolean);
    return Array.from(new Set(parts)).join(':');
}
export function getEnhancedSshEnv(extraEnv) {
    const homeDir = process.env.HOME || os.homedir();
    const userInfo = os.userInfo();
    const authSock = resolveSshAuthSock(undefined, homeDir);
    return {
        ...process.env,
        HOME: homeDir,
        USER: process.env.USER || userInfo.username,
        LOGNAME: process.env.LOGNAME || userInfo.username,
        LANG: process.env.LANG || 'en_US.UTF-8',
        LC_ALL: process.env.LC_ALL || 'en_US.UTF-8',
        ...(authSock ? { SSH_AUTH_SOCK: authSock } : {}),
        PATH: resolveEnhancedPath(),
        ...(extraEnv || {}),
    };
}
function resolveKeyFilePath(rawKeyPath, homeDir = os.homedir()) {
    const trimmed = rawKeyPath.trim().replace(/^['"]|['"]$/g, '');
    if (trimmed.startsWith('~/')) {
        return path.join(homeDir, trimmed.slice(2));
    }
    if (trimmed.startsWith('%d/')) {
        return path.join(homeDir, trimmed.slice(3));
    }
    if (path.isAbsolute(trimmed)) {
        return trimmed;
    }
    return path.join(homeDir, '.ssh', trimmed);
}
function parseJumpHop(rawHop) {
    let rest = rawHop.trim();
    let user;
    const atIdx = rest.lastIndexOf('@');
    if (atIdx !== -1) {
        user = rest.slice(0, atIdx);
        rest = rest.slice(atIdx + 1);
    }
    const bracketMatch = rest.match(/^\[([^\]]+)\](?::(\d+))?$/);
    if (bracketMatch) {
        return { user, host: bracketMatch[1], port: bracketMatch[2] };
    }
    const colonParts = rest.split(':');
    if (colonParts.length === 2 && /^\d+$/.test(colonParts[1])) {
        return { user, host: colonParts[0], port: colonParts[1] };
    }
    return { user, host: rest };
}
export function buildProxyCommandFromJump(proxyJump, sshExec = '/usr/bin/ssh', sshConfigPath) {
    const hops = proxyJump
        .split(',')
        .map((h) => h.trim())
        .filter(Boolean);
    if (hops.length === 0)
        return '';
    const lastHop = parseJumpHop(hops[hops.length - 1]);
    const priorHops = hops
        .slice(0, -1)
        .map((h) => {
        const parsed = parseJumpHop(h);
        const userHost = parsed.user ? `${parsed.user}@${parsed.host}` : parsed.host;
        return parsed.port ? `${userHost}:${parsed.port}` : userHost;
    })
        .join(',');
    const parts = [
        sshExec,
        '-o',
        'StrictHostKeyChecking=no',
        '-o',
        'UserKnownHostsFile=/dev/null',
        '-o',
        'ServerAliveInterval=15',
        '-o',
        'BatchMode=yes',
    ];
    if (sshConfigPath && fs.existsSync(sshConfigPath)) {
        parts.push('-F', sshConfigPath);
    }
    if (priorHops) {
        parts.push('-J', priorHops);
    }
    if (lastHop.port) {
        parts.push('-p', lastHop.port);
    }
    parts.push('-W', "'[%h]:%p'");
    parts.push(lastHop.user ? `${lastHop.user}@${lastHop.host}` : lastHop.host);
    return parts.join(' ');
}
export function resolveEffectiveSshTarget(server, homeDir = process.env.HOME || os.homedir()) {
    const alias = server.name || server.host;
    const identityFiles = [];
    if (server.key) {
        identityFiles.push(resolveKeyFilePath(server.key, homeDir));
    }
    let resolvedHost = server.host || alias;
    let resolvedPort = server.port || 22;
    let resolvedUser = server.user || os.userInfo().username || 'root';
    let resolvedProxyCommand = server.proxyCommand;
    let resolvedProxyJump = server.proxyJump;
    let resolvedIdentityAgent;
    const sshBin = fs.existsSync('/usr/bin/ssh') ? '/usr/bin/ssh' : 'ssh';
    const sshConfigPath = path.join(homeDir, '.ssh', 'config');
    const useCustomConfigFlag = homeDir !== os.homedir() && fs.existsSync(sshConfigPath);
    if (alias) {
        try {
            const args = useCustomConfigFlag ? ['-F', sshConfigPath, '-G', alias] : ['-G', alias];
            const out = execFileSync(sshBin, args, {
                encoding: 'utf8',
                timeout: 1500,
                env: getEnhancedSshEnv({ HOME: homeDir }),
                stdio: ['ignore', 'pipe', 'ignore'],
            });
            const hasAlias = hasSshHostAlias(alias, homeDir);
            for (const rawLine of out.split('\n')) {
                const line = rawLine.trim();
                if (!line)
                    continue;
                const spaceIdx = line.indexOf(' ');
                if (spaceIdx === -1)
                    continue;
                const k = line.slice(0, spaceIdx).toLowerCase();
                const v = line.slice(spaceIdx + 1).trim();
                if (!v)
                    continue;
                if (k === 'hostname' && (hasAlias || !server.host || v !== alias)) {
                    resolvedHost = v;
                }
                else if (k === 'port' && hasAlias) {
                    const p = parseInt(v, 10);
                    if (!isNaN(p) && p > 0)
                        resolvedPort = p;
                }
                else if (k === 'user' && hasAlias) {
                    resolvedUser = v;
                }
                else if (k === 'identityfile') {
                    const fullKey = resolveKeyFilePath(v, homeDir);
                    if (!identityFiles.includes(fullKey))
                        identityFiles.push(fullKey);
                }
                else if (k === 'identityagent' && v.toLowerCase() !== 'none') {
                    resolvedIdentityAgent = v;
                }
                else if (k === 'proxycommand' && v.toLowerCase() !== 'none') {
                    resolvedProxyCommand = v;
                }
                else if (k === 'proxyjump' && v.toLowerCase() !== 'none') {
                    resolvedProxyJump = v;
                }
            }
        }
        catch {
            // Fallback to ServerConfig properties if ssh -G is unavailable
        }
    }
    if (!resolvedProxyCommand && resolvedProxyJump) {
        const sshExec = fs.existsSync('/usr/bin/ssh') ? '/usr/bin/ssh' : 'ssh';
        resolvedProxyCommand = buildProxyCommandFromJump(server.proxyJump || resolvedProxyJump, sshExec, useCustomConfigFlag ? sshConfigPath : undefined);
    }
    return {
        alias,
        host: resolvedHost,
        port: resolvedPort,
        user: resolvedUser,
        identityFiles,
        identityAgent: resolvedIdentityAgent,
        proxyCommand: resolvedProxyCommand,
        proxyJump: resolvedProxyJump,
    };
}
export function resolveUsablePrivateKeys(target) {
    const buffers = [];
    const seenContent = new Set();
    for (const filePath of target.identityFiles) {
        try {
            if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile())
                continue;
            const buf = fs.readFileSync(filePath);
            if (buf.length === 0 || isEncryptedPrivateKeyBuffer(buf)) {
                continue;
            }
            const keyStr = buf.toString('utf8').trim();
            if (seenContent.has(keyStr))
                continue;
            seenContent.add(keyStr);
            buffers.push(buf);
        }
        catch {
            // Ignore unreadable key file
        }
    }
    return buffers;
}
function expandOpenSshTokens(template, target) {
    return template.replace(/%([%hprn])/g, (_m, tok) => {
        if (tok === '%')
            return '%';
        if (tok === 'h')
            return target.host;
        if (tok === 'p')
            return String(target.port);
        if (tok === 'r')
            return target.user;
        if (tok === 'n')
            return target.alias || target.host;
        return _m;
    });
}
function createProxyCommandDuplex(proxyCmdTemplate, target) {
    const expandedCmd = expandOpenSshTokens(proxyCmdTemplate, target);
    const child = spawn('/bin/sh', ['-c', expandedCmd], {
        env: getEnhancedSshEnv(),
        stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stderrText = '';
    let cleaned = false;
    const cleanup = () => {
        if (cleaned)
            return;
        cleaned = true;
        try {
            child.kill('SIGTERM');
        }
        catch { }
    };
    const sock = new Duplex({
        read() { },
        write(chunk, encoding, callback) {
            if (!child.stdin || child.stdin.destroyed) {
                callback(new Error('ProxyCommand stdin is closed'));
                return;
            }
            child.stdin.write(chunk, encoding, callback);
        },
        final(callback) {
            try {
                child.stdin?.end();
            }
            catch { }
            callback();
        },
        destroy(err, callback) {
            cleanup();
            callback(err);
        },
    });
    child.stdout?.on('data', (chunk) => {
        sock.push(chunk);
    });
    child.stderr?.on('data', (chunk) => {
        stderrText = (stderrText + chunk.toString('utf8')).slice(-1000);
    });
    child.stdout?.on('end', () => {
        sock.push(null);
    });
    child.on('error', (err) => {
        sock.destroy(err);
    });
    child.on('close', (code) => {
        if (code && code !== 0 && !sock.destroyed) {
            const detail = stderrText.trim();
            sock.destroy(new Error(detail ? `ProxyCommand failed (${code}): ${detail}` : `ProxyCommand exited with code ${code}`));
        }
    });
    return { sock, cleanup };
}
export function buildNativeSshArgs(server, extraArgs = [], homeDirOverride) {
    const homeDir = homeDirOverride || process.env.HOME || os.homedir();
    const args = [
        '-o',
        'ServerAliveInterval=15',
        '-o',
        'ServerAliveCountMax=3',
        '-o',
        'StrictHostKeyChecking=no',
        '-o',
        'ControlMaster=auto',
        '-o',
        'ControlPath=/tmp/hugremote-ssh-%C',
        '-o',
        'ControlPersist=10m',
    ];
    // Separate leading SSH option flags (e.g. -tt, -o BatchMode=yes) from the remote command
    const optionFlags = [];
    const commandArgs = [];
    for (let i = 0; i < extraArgs.length; i++) {
        const token = extraArgs[i];
        if (commandArgs.length === 0 && token.startsWith('-')) {
            optionFlags.push(token);
            if ((token === '-o' || token === '-p' || token === '-i' || token === '-F' || token === '-J') && i + 1 < extraArgs.length) {
                optionFlags.push(extraArgs[++i]);
            }
        }
        else {
            commandArgs.push(token);
        }
    }
    args.push(...optionFlags);
    const hasAliasInConfig = Boolean(server.name) && hasSshHostAlias(server.name, homeDir);
    if (hasAliasInConfig) {
        const sshConfigPath = path.join(homeDir, '.ssh', 'config');
        if (homeDirOverride && fs.existsSync(sshConfigPath)) {
            args.push('-F', sshConfigPath);
        }
        args.push(server.name);
    }
    else {
        if (server.key) {
            const resolvedKey = resolveKeyFilePath(server.key, homeDir);
            if (fs.existsSync(resolvedKey)) {
                args.push('-i', resolvedKey);
            }
        }
        if (server.proxyJump) {
            args.push('-J', server.proxyJump);
        }
        else if (server.proxyCommand) {
            args.push('-o', `ProxyCommand=${server.proxyCommand}`);
        }
        if (server.port && server.port !== 22) {
            args.push('-p', String(server.port));
        }
        const dest = server.user ? `${server.user}@${server.host}` : server.host;
        args.push(dest);
    }
    args.push(...commandArgs);
    return args;
}
class SshConnectionPool {
    clients = new Map();
    connecting = new Map();
    sftpWrappers = new Map();
    connectedServerIds = new Set();
    nativeFallbackUntil = new Map();
    testSpawners = null;
    setNativeSshSpawnersForTest(spawners) {
        this.testSpawners = spawners;
        this.nativeFallbackUntil.clear();
    }
    shouldUseNativeFallback(serverId) {
        const until = this.nativeFallbackUntil.get(serverId);
        if (!until)
            return false;
        if (Date.now() > until) {
            this.nativeFallbackUntil.delete(serverId);
            return false;
        }
        return true;
    }
    markNativeFallback(serverId) {
        this.nativeFallbackUntil.set(serverId, Date.now() + NATIVE_FALLBACK_TTL_MS);
    }
    async getClient(server) {
        const existing = this.clients.get(server.id);
        if (existing) {
            return existing;
        }
        if (this.shouldUseNativeFallback(server.id)) {
            throw new Error('Using native OpenSSH fallback for this host');
        }
        const pending = this.connecting.get(server.id);
        if (pending) {
            return pending;
        }
        const connectPromise = new Promise((resolve, reject) => {
            const conn = new Client();
            let settled = false;
            let proxyCleanup = null;
            const target = resolveEffectiveSshTarget(server);
            const usableKeys = resolveUsablePrivateKeys(target);
            const agent = resolveSshAuthSock(target.identityAgent);
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
                this.nativeFallbackUntil.delete(server.id);
                this.clients.set(server.id, conn);
                this.connectedServerIds.add(server.id);
                resolve(conn);
            });
            conn.on('error', (err) => {
                this.connecting.delete(server.id);
                this.clients.delete(server.id);
                this.sftpWrappers.delete(server.id);
                proxyCleanup?.();
                if (!settled) {
                    settled = true;
                    this.markNativeFallback(server.id);
                    reject(err);
                }
            });
            conn.on('close', () => {
                this.connecting.delete(server.id);
                this.clients.delete(server.id);
                this.sftpWrappers.delete(server.id);
                proxyCleanup?.();
                if (!settled) {
                    settled = true;
                    this.markNativeFallback(server.id);
                    reject(new Error('SSH connection closed before ready'));
                }
            });
            try {
                const authHandlerList = ['none'];
                for (const keyBuf of usableKeys) {
                    authHandlerList.push({
                        type: 'publickey',
                        username: target.user,
                        key: keyBuf,
                    });
                }
                if (agent) {
                    authHandlerList.push('agent');
                }
                if (server.password) {
                    authHandlerList.push('password', 'keyboard-interactive');
                }
                const baseConfig = {
                    username: target.user,
                    privateKey: usableKeys[0],
                    password: server.password,
                    agent,
                    tryKeyboard: Boolean(server.password),
                    authHandler: authHandlerList,
                    readyTimeout: 10000,
                    keepaliveInterval: 10000,
                };
                if (target.proxyCommand) {
                    const proxy = createProxyCommandDuplex(target.proxyCommand, target);
                    proxyCleanup = proxy.cleanup;
                    proxy.sock.on('error', (proxyErr) => {
                        if (!settled) {
                            settled = true;
                            this.connecting.delete(server.id);
                            this.markNativeFallback(server.id);
                            proxyCleanup?.();
                            try {
                                conn.end();
                            }
                            catch { }
                            reject(proxyErr);
                        }
                    });
                    baseConfig.sock = proxy.sock;
                }
                else {
                    baseConfig.host = target.host;
                    baseConfig.port = target.port || 22;
                }
                conn.connect(baseConfig);
            }
            catch (syncErr) {
                this.connecting.delete(server.id);
                proxyCleanup?.();
                if (!settled) {
                    settled = true;
                    this.markNativeFallback(server.id);
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
        this.connectedServerIds.add(server.id);
        if (this.testSpawners?.spawnExec) {
            return this.testSpawners.spawnExec(server, command, options);
        }
        const sshBin = fs.existsSync('/usr/bin/ssh') ? '/usr/bin/ssh' : 'ssh';
        const sshArgs = buildNativeSshArgs(server, ['-o', 'BatchMode=yes', command]);
        const child = spawn(sshBin, sshArgs, {
            env: getEnhancedSshEnv(options?.env),
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        const channelEmitter = new EventEmitter();
        channelEmitter.stderr = new EventEmitter();
        channelEmitter.write = (data, cb) => child.stdin?.write(data, cb);
        channelEmitter.end = (data, cb) => {
            if (data !== undefined)
                child.stdin?.end(data, cb);
            else
                child.stdin?.end(cb);
        };
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
        // Emit 'exit' and 'close' on 'close' so all stdout/stderr chunks are guaranteed to be flushed first.
        child.on('close', (code, signal) => {
            channelEmitter.emit('exit', code, signal || undefined);
            channelEmitter.emit('close', code ?? undefined, signal || undefined);
        });
        return channelEmitter;
    }
    spawnNativeSshPty(sessionInfo, server) {
        this.connectedServerIds.add(server.id);
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
            env: getEnhancedSshEnv({
                TERM: 'xterm-256color',
                COLORTERM: 'truecolor',
            }),
        });
        const sanitizedCwd = sessionInfo.cwd
            ? sanitizeRemoteWorkspacePath(sessionInfo.cwd, server.user)
            : undefined;
        let sentInitialCwd = !sanitizedCwd;
        let buffer = '';
        const dataCallbacks = [];
        const exitCallbacks = [];
        ptyProcess.onData((data) => {
            buffer += data;
            if (buffer.length > MAX_BUFFER_LENGTH) {
                let startIdx = buffer.length - MAX_BUFFER_LENGTH;
                const nextNewline = buffer.indexOf('\n', startIdx);
                if (nextNewline !== -1 && nextNewline < startIdx + 2048) {
                    startIdx = nextNewline + 1;
                }
                buffer = buffer.substring(startIdx);
            }
            if (!sentInitialCwd && sanitizedCwd) {
                sentInitialCwd = true;
                setTimeout(() => {
                    try {
                        ptyProcess.write(`cd "${sanitizedCwd}" 2>/dev/null && clear\r`);
                    }
                    catch { }
                }, 120);
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
        if (this.shouldUseNativeFallback(server.id)) {
            return this.spawnNativeSshExec(server, command, options);
        }
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
            this.markNativeFallback(server.id);
            return this.spawnNativeSshExec(server, command, options);
        }
    }
    async runRemoteCommand(server, command, stdinBuffer, timeoutMs = 30000) {
        const stream = await this.executeCommand(server, command);
        return new Promise((resolve, reject) => {
            let settled = false;
            let exitCode;
            const outChunks = [];
            const errChunks = [];
            const finish = (err) => {
                if (settled)
                    return;
                settled = true;
                clearTimeout(timer);
                if (err) {
                    reject(err);
                }
                else {
                    resolve({
                        stdout: Buffer.concat(outChunks),
                        stderr: Buffer.concat(errChunks).toString('utf8'),
                        exitCode: exitCode ?? 0,
                    });
                }
            };
            const timer = setTimeout(() => {
                try {
                    stream.close();
                }
                catch { }
                finish(new Error('Remote SSH command timed out'));
            }, timeoutMs);
            stream.on('data', (chunk) => {
                outChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
            });
            stream.stderr?.on('data', (chunk) => {
                errChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
            });
            stream.on('error', (err) => finish(err));
            stream.on('exit', (code) => {
                if (typeof code === 'number')
                    exitCode = code;
            });
            stream.on('close', (code) => {
                if (exitCode === undefined && typeof code === 'number') {
                    exitCode = code;
                }
                finish();
            });
            if (stdinBuffer !== undefined) {
                try {
                    stream.end(stdinBuffer);
                }
                catch (err) {
                    finish(err);
                }
            }
        });
    }
    async createShell(sessionInfo, server) {
        if (this.shouldUseNativeFallback(server.id)) {
            return this.spawnNativeSshPty(sessionInfo, server);
        }
        try {
            const client = await this.getClient(server);
            const sanitizedCwd = sessionInfo.cwd
                ? sanitizeRemoteWorkspacePath(sessionInfo.cwd, server.user)
                : undefined;
            return await new Promise((resolve, reject) => {
                client.shell({
                    term: 'xterm-256color',
                    cols: Math.max(10, sessionInfo.cols || 80),
                    rows: Math.max(5, sessionInfo.rows || 24),
                }, (err, stream) => {
                    if (err)
                        return reject(err);
                    if (sanitizedCwd) {
                        setTimeout(() => {
                            try {
                                stream.write(`cd "${sanitizedCwd}" 2>/dev/null && clear\r`);
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
                            let startIdx = buffer.length - MAX_BUFFER_LENGTH;
                            const nextNewline = buffer.indexOf('\n', startIdx);
                            if (nextNewline !== -1 && nextNewline < startIdx + 2048) {
                                startIdx = nextNewline + 1;
                            }
                            buffer = buffer.substring(startIdx);
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
            this.markNativeFallback(server.id);
            return this.spawnNativeSshPty(sessionInfo, server);
        }
    }
    disconnect(serverId) {
        this.connecting.delete(serverId);
        this.connectedServerIds.delete(serverId);
        this.nativeFallbackUntil.delete(serverId);
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
        return this.clients.has(serverId) || this.connectedServerIds.has(serverId);
    }
}
export const sshPool = new SshConnectionPool();
