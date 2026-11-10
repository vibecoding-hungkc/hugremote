import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { sanitizeRemoteWorkspacePath } from '../config.js';
import { sshPool } from './sshPool.js';
export const MAX_GIT_SCAN_DEPTH = 5;
const GIT_TIMEOUT_MS = 30_000;
const MAX_OUTPUT_BYTES = 8 * 1024 * 1024;
const IGNORED_SCAN_DIRS = new Set([
    '.git',
    'node_modules',
    'dist',
    'build',
    '.next',
    '.nuxt',
    'vendor',
    'target',
    '.venv',
    'venv',
    '__pycache__',
    '.cache',
    'coverage',
]);
export function resolveProjectSubpath(rootPath, repoPath, maxDepth = MAX_GIT_SCAN_DEPTH) {
    const rawInput = (repoPath ?? '').trim();
    if (!rawInput || rawInput === '.') {
        return { targetPath: rootPath, relPath: '.', depth: 0 };
    }
    const raw = rawInput.replace(/^(\.\/)+/, '').replace(/\/+$/, '');
    if (!raw || raw === '.') {
        return { targetPath: rootPath, relPath: '.', depth: 0 };
    }
    if (raw.includes('\0') || raw.includes('\\') || raw.startsWith('/') || raw.startsWith('~')) {
        throw new Error('Invalid repoPath');
    }
    const segments = raw.split('/');
    if (segments.some(seg => !seg || seg === '.' || seg === '..')) {
        throw new Error('Invalid repoPath');
    }
    if (segments.length > maxDepth) {
        throw new Error(`Repository path exceeds maximum depth of ${maxDepth}`);
    }
    const targetPath = rootPath === '~'
        ? `~/${raw}`
        : `${rootPath.replace(/\/+$/, '')}/${raw}`;
    if (!rootPath.startsWith('~')) {
        const absRoot = path.resolve(rootPath);
        const absTarget = path.resolve(targetPath);
        if (fs.existsSync(absRoot) && fs.existsSync(absTarget)) {
            const realRoot = fs.realpathSync(absRoot);
            const realTarget = fs.realpathSync(absTarget);
            if (realTarget !== realRoot && !realTarget.startsWith(realRoot + path.sep)) {
                throw new Error('Invalid repoPath');
            }
        }
    }
    return { targetPath, relPath: raw, depth: segments.length };
}
function shellQuote(value) {
    if (value.includes('\0'))
        throw new Error('Git arguments must not contain NUL');
    return "'" + value.replace(/'/g, "'\\''") + "'";
}
/** A request-scoped SSH executor; never mutates the local singleton. */
export function createRemoteGitExecutor(server, executeCommand = sshPool.executeCommand.bind(sshPool), timeoutMs = GIT_TIMEOUT_MS) {
    if (server.type !== 'ssh')
        throw new Error('Remote Git requires an SSH server');
    return (cwd, args) => {
        const cleanCwd = cwd.startsWith('/Users/') ? sanitizeRemoteWorkspacePath(cwd, server.user) : cwd;
        const directory = cleanCwd === '~' ? '"$HOME"' : cleanCwd.startsWith('~/')
            ? `"$HOME"/${shellQuote(cleanCwd.slice(2))}` : shellQuote(cleanCwd);
        const command = `GIT_TERMINAL_PROMPT=0 git -C ${directory} ${args.map(shellQuote).join(' ')}`;
        return new Promise((resolve, reject) => {
            let channel;
            let settled = false;
            let exitCode;
            let exitSignal;
            const stdout = [];
            const stderr = [];
            let bytes = 0;
            const stop = () => { try {
                channel?.signal('TERM');
                channel?.close();
            }
            catch { } };
            const finish = (error) => {
                if (settled)
                    return;
                settled = true;
                clearTimeout(timer);
                if (error)
                    reject(error);
                else
                    resolve(Buffer.concat(stdout).toString('utf8'));
            };
            // Do not echo stderr/argv: transport and Git errors can include credential URLs.
            const failure = (reason) => new Error(`Remote Git ${args[0] || 'command'} failed: ${reason}`);
            const timer = setTimeout(() => { finish(failure('timed out')); stop(); }, timeoutMs);
            const collect = (chunks, data) => {
                const chunk = Buffer.isBuffer(data) ? data : Buffer.from(data);
                bytes += chunk.length;
                if (bytes > MAX_OUTPUT_BYTES) {
                    finish(failure('output limit exceeded'));
                    stop();
                }
                else
                    chunks.push(chunk);
            };
            Promise.resolve().then(() => executeCommand(server, command)).then(stream => {
                channel = stream;
                if (settled) {
                    stream.on('error', () => { });
                    stop();
                    return;
                }
                stream.on('data', (data) => collect(stdout, data));
                stream.stderr.on('data', data => collect(stderr, data));
                stream.stderr.on('error', () => { finish(failure('stderr stream error')); stop(); });
                stream.on('error', () => { finish(failure('SSH stream error')); stop(); });
                stream.on('exit', (code, signal) => {
                    exitCode = code === null ? undefined : code;
                    exitSignal = signal;
                    if (signal || (code !== null && code !== 0)) {
                        finish(failure(signal ? 'terminated by signal' : `exit code ${code}`));
                        stop();
                    }
                });
                stream.on('close', (code, signal) => {
                    const result = exitCode ?? code;
                    if (exitSignal || signal)
                        finish(failure('terminated by signal'));
                    else if (result === 0)
                        finish();
                    else
                        finish(failure(result === undefined ? 'SSH channel closed without exit status' : `exit code ${result}`));
                });
            }, () => finish(failure('SSH connection or execution error')));
        });
    };
}
export function createRemoteRepoScanner(server, executeCommand = sshPool.executeCommand.bind(sshPool), timeoutMs = GIT_TIMEOUT_MS) {
    if (server.type !== 'ssh')
        throw new Error('Remote Git scanner requires an SSH server');
    return (rootPath, maxDepth) => {
        const cleanRoot = rootPath.startsWith('/Users/') ? sanitizeRemoteWorkspacePath(rootPath, server.user) : rootPath;
        const directory = cleanRoot === '~' ? '"$HOME"' : cleanRoot.startsWith('~/')
            ? `"$HOME"/${shellQuote(cleanRoot.slice(2))}` : shellQuote(cleanRoot);
        const findDepth = Math.max(1, Math.min(maxDepth, MAX_GIT_SCAN_DEPTH)) + 1;
        const pruneExpr = Array.from(IGNORED_SCAN_DIRS)
            .filter(d => d !== '.git')
            .map(d => `-name ${shellQuote(d)}`)
            .join(' -o ');
        const command = `cd ${directory} && find . -maxdepth ${findDepth} \\( ${pruneExpr} \\) -prune -o -name .git -print`;
        return new Promise((resolve, reject) => {
            let channel;
            let settled = false;
            const stdout = [];
            const stop = () => { try {
                channel?.signal('TERM');
                channel?.close();
            }
            catch { } };
            const finish = (err) => {
                if (settled)
                    return;
                settled = true;
                clearTimeout(timer);
                if (err)
                    reject(err);
                else {
                    const raw = Buffer.concat(stdout).toString('utf8');
                    const rels = raw
                        .split('\n')
                        .map(l => l.trim())
                        .filter(Boolean)
                        .map(l => l.replace(/^\.\//, '').replace(/\/?\.git$/, '') || '.');
                    resolve(Array.from(new Set(rels)));
                }
            };
            const timer = setTimeout(() => { finish(new Error('Remote Git scan timed out')); stop(); }, timeoutMs);
            Promise.resolve().then(() => executeCommand(server, command)).then(stream => {
                channel = stream;
                if (settled) {
                    stream.on('error', () => { });
                    stop();
                    return;
                }
                stream.on('data', (data) => stdout.push(Buffer.isBuffer(data) ? data : Buffer.from(data)));
                stream.stderr?.on('data', () => { });
                stream.on('error', () => finish(new Error('Remote Git scan stream error')));
                stream.on('close', () => finish());
            }, () => finish(new Error('Remote Git scan connection error')));
        });
    };
}
export function createGitService(server) {
    return server.type === 'local'
        ? gitService
        : new GitService(createRemoteGitExecutor(server), createRemoteRepoScanner(server));
}
function parseNumstat(raw) {
    const map = new Map();
    raw.split('\n').filter(Boolean).forEach((line) => {
        const [a, d, ...rest] = line.split('\t');
        const file = rest.join('\t');
        map.set(file, {
            additions: a === '-' ? 0 : Number(a || 0),
            deletions: d === '-' ? 0 : Number(d || 0),
        });
    });
    return map;
}
function parseDiff(raw, includeFileHeaders = false) {
    let oldLine = 0;
    let newLine = 0;
    const lines = [];
    for (const line of raw.split('\n')) {
        if (includeFileHeaders && line.startsWith('diff --git ')) {
            const m = line.match(/^diff --git a\/(.+?) b\/(.+)$/);
            const fileLabel = m ? m[2] : line.slice('diff --git '.length);
            lines.push({ type: 'hunk', content: `=== ${fileLabel} ===` });
        }
        else if (line.startsWith('@@')) {
            const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
            oldLine = match ? Number(match[1]) : 0;
            newLine = match ? Number(match[2]) : 0;
            lines.push({ type: 'hunk', content: line });
        }
        else if (line.startsWith('+') && !line.startsWith('+++')) {
            lines.push({ type: 'added', newLine: newLine++, content: line.slice(1) });
        }
        else if (line.startsWith('-') && !line.startsWith('---')) {
            lines.push({ type: 'deleted', oldLine: oldLine++, content: line.slice(1) });
        }
        else if (!line.startsWith('diff --git') && !line.startsWith('index ') && !line.startsWith('---') && !line.startsWith('+++')) {
            lines.push({ type: 'context', oldLine: oldLine ? oldLine++ : undefined, newLine: newLine ? newLine++ : undefined, content: line.startsWith(' ') ? line.slice(1) : line });
        }
    }
    return lines;
}
function normalizeNumstatFilePath(rawPath) {
    const braceRename = rawPath.match(/^(.*)\{([^{}]*) => ([^{}]*)\}(.*)$/);
    if (braceRename) {
        return `${braceRename[1]}${braceRename[3]}${braceRename[4]}`.replace(/\/+/g, '/');
    }
    if (rawPath.includes(' => ')) {
        const parts = rawPath.split(' => ');
        return parts[parts.length - 1].trim();
    }
    return rawPath.trim();
}
export class GitService {
    executor;
    remoteScanner;
    constructor(executor, remoteScanner) {
        this.executor = executor;
        this.remoteScanner = remoteScanner;
    }
    expandLocalPath(rawPath) {
        if (rawPath === '~')
            return os.homedir();
        if (rawPath.startsWith('~/'))
            return path.join(os.homedir(), rawPath.slice(2));
        return path.resolve(rawPath);
    }
    scanLocalGitDirs(rootPath, maxDepth = MAX_GIT_SCAN_DEPTH) {
        const absRoot = this.expandLocalPath(rootPath);
        const found = [];
        const walk = (absDir, relPath, depth) => {
            try {
                if (fs.existsSync(path.join(absDir, '.git'))) {
                    found.push(relPath);
                }
            }
            catch {
                // Ignore unreadable .git entry
            }
            if (depth >= maxDepth)
                return;
            let entries = [];
            try {
                entries = fs.readdirSync(absDir, { withFileTypes: true });
            }
            catch {
                return;
            }
            entries.sort((a, b) => a.name.localeCompare(b.name));
            for (const entry of entries) {
                if (!entry.isDirectory())
                    continue;
                if (entry.name.startsWith('.') || IGNORED_SCAN_DIRS.has(entry.name))
                    continue;
                const childRel = relPath === '.' ? entry.name : `${relPath}/${entry.name}`;
                walk(path.join(absDir, entry.name), childRel, depth + 1);
            }
        };
        walk(absRoot, '.', 0);
        return found;
    }
    async discoverRepos(rootPath, maxDepth = MAX_GIT_SCAN_DEPTH) {
        const effectiveMaxDepth = Math.max(0, Math.min(maxDepth, MAX_GIT_SCAN_DEPTH));
        let candidateRels = [];
        if (this.executor) {
            if (this.remoteScanner) {
                candidateRels = await this.remoteScanner(rootPath, effectiveMaxDepth).catch(() => []);
            }
            if (candidateRels.length === 0) {
                candidateRels = ['.'];
            }
        }
        else {
            candidateRels = this.scanLocalGitDirs(rootPath, effectiveMaxDepth);
            if (candidateRels.length === 0) {
                const absRoot = this.expandLocalPath(rootPath);
                const topLevel = await this.execGit(absRoot, ['rev-parse', '--show-toplevel']).then(s => s.trim()).catch(() => '');
                if (topLevel)
                    candidateRels = ['.'];
            }
        }
        const validTargets = [];
        for (const rel of candidateRels) {
            try {
                const resolved = resolveProjectSubpath(rootPath, rel, effectiveMaxDepth);
                validTargets.push(resolved);
            }
            catch {
                // Ignore paths outside allowed depth
            }
        }
        validTargets.sort((a, b) => a.depth - b.depth || a.relPath.localeCompare(b.relPath));
        const rootName = path.posix.basename(rootPath.replace(/\/+$/, '')) || rootPath;
        const summaries = await Promise.all(validTargets.map(async ({ relPath, targetPath, depth }) => {
            try {
                const execTarget = this.executor ? targetPath : this.expandLocalPath(targetPath);
                const st = await this.getStatus(execTarget, { fetch: false });
                const stagedCount = st.files.filter(f => f.staged).length;
                const untrackedCount = st.files.filter(f => f.status === '??').length;
                const unstagedCount = st.files.filter(f => !f.staged && f.status !== '??').length;
                const changedCount = st.files.length;
                return {
                    relPath,
                    name: relPath === '.' ? rootName : path.posix.basename(relPath),
                    depth,
                    branch: st.branch || 'main',
                    ahead: st.ahead || 0,
                    behind: st.behind || 0,
                    hasUpstream: Boolean(st.hasUpstream),
                    upstream: st.upstream || '',
                    changedCount,
                    stagedCount,
                    unstagedCount,
                    untrackedCount,
                    clean: changedCount === 0,
                };
            }
            catch {
                return null;
            }
        }));
        return summaries.filter((item) => item !== null);
    }
    execGit(cwd, args) {
        if (this.executor)
            return this.executor(cwd, args);
        return new Promise((resolve, reject) => {
            const child = spawn('git', ['-C', cwd, ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
            let stdout = '';
            let stderr = '';
            child.stdout.on('data', (d) => (stdout += d.toString()));
            child.stderr.on('data', (d) => (stderr += d.toString()));
            child.on('error', reject);
            child.on('close', (code) => {
                if (code === 0)
                    resolve(stdout);
                else
                    reject(new Error(stderr || stdout || `git exited with ${code}`));
            });
        });
    }
    async fetchRemote(cwd) {
        try {
            await this.execGit(cwd, ['fetch', '--prune']);
            return { fetched: true };
        }
        catch (err) {
            return { fetched: false, error: err.message || 'fetch failed' };
        }
    }
    async countAheadBehind(cwd) {
        const upstream = await this.execGit(cwd, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']).then((s) => s.trim()).catch(() => '');
        if (!upstream)
            return { ahead: 0, behind: 0, hasUpstream: false, upstream: '' };
        const counts = await this.execGit(cwd, ['rev-list', '--left-right', '--count', 'HEAD...@{u}']).then((s) => s.trim()).catch(() => '0\t0');
        const [aheadRaw, behindRaw] = counts.split(/\s+/);
        return { ahead: Number(aheadRaw || 0), behind: Number(behindRaw || 0), hasUpstream: true, upstream };
    }
    async getStatus(cwd, options = {}) {
        const fetchedAt = new Date().toISOString();
        if (options.fetch !== false) {
            await this.fetchRemote(cwd).catch(() => ({ fetched: false }));
        }
        const [rootRaw, branchRaw, statusRaw, numstatRaw, aheadBehind] = await Promise.all([
            this.execGit(cwd, ['rev-parse', '--show-toplevel']),
            this.execGit(cwd, ['rev-parse', '--abbrev-ref', 'HEAD']).catch(() => this.execGit(cwd, ['symbolic-ref', '--short', 'HEAD']).catch(() => 'main')),
            this.execGit(cwd, ['status', '--porcelain=v1']),
            this.execGit(cwd, ['diff', '--numstat', 'HEAD']).catch(() => ''),
            this.countAheadBehind(cwd),
        ]);
        const root = rootRaw.trim();
        const nums = parseNumstat(numstatRaw);
        const files = statusRaw.split('\n').filter(Boolean).map((line) => {
            const xyRaw = line.slice(0, 2);
            const xy = xyRaw.trim() || 'M';
            const staged = xyRaw[0] !== ' ' && xyRaw[0] !== '?';
            const filePath = line.slice(3).replace(/^.* -> /, '');
            const stat = nums.get(filePath) || { additions: 0, deletions: 0 };
            const status = (xy === '??' ? '??' : xy.includes('A') ? 'A' : xy.includes('D') ? 'D' : xy.includes('R') ? 'R' : 'M');
            return { path: filePath, status, staged, additions: stat.additions, deletions: stat.deletions };
        });
        return {
            repoRoot: root,
            branch: branchRaw.trim() || 'main',
            upstream: aheadBehind.upstream,
            hasUpstream: aheadBehind.hasUpstream,
            ahead: aheadBehind.ahead,
            behind: aheadBehind.behind,
            fetchedAt,
            files,
        };
    }
    async getDiff(cwd, file) {
        let raw = await this.execGit(cwd, ['diff', '--', file]);
        if (!raw.trim()) {
            raw = await this.execGit(cwd, ['diff', '--cached', '--', file]);
        }
        return { file, lines: parseDiff(raw) };
    }
    async getBranches(cwd) {
        const raw = await this.execGit(cwd, ['branch', '--format=%(HEAD)|%(refname:short)']);
        return raw.split('\n').filter(Boolean).map((line) => {
            const [head, name] = line.split('|');
            return { name, current: head.trim() === '*' };
        });
    }
    async checkout(cwd, branch) {
        const clean = branch.trim();
        if (!clean)
            throw new Error('Branch is required');
        if (clean.startsWith('-') || /[\s\x00-\x1f\x7f~^:?*\[\\]/.test(clean) || clean.includes('..') || clean.includes('@{')) {
            throw new Error('Invalid branch name');
        }
        await this.execGit(cwd, ['checkout', clean]);
    }
    async pull(cwd) {
        return await this.execGit(cwd, ['pull', '--ff-only']);
    }
    async push(cwd) {
        try {
            return await this.execGit(cwd, ['push']);
        }
        catch (err) {
            const branch = await this.execGit(cwd, ['rev-parse', '--abbrev-ref', 'HEAD']).then((s) => s.trim()).catch(() => '');
            if (!branch)
                throw err;
            return await this.execGit(cwd, ['push', '-u', 'origin', branch]);
        }
    }
    async stage(cwd, file) {
        await this.execGit(cwd, ['add', '--', file]);
    }
    async unstage(cwd, file) {
        await this.execGit(cwd, ['restore', '--staged', '--', file]);
    }
    async commit(cwd, message) {
        const clean = message.trim();
        if (!clean)
            throw new Error('Commit message is required');
        return await this.execGit(cwd, ['commit', '-m', clean]);
    }
    async getCommitHistory(cwd, options = {}) {
        const limit = Math.max(1, Math.min(Number(options.limit) || 40, 100));
        const cleanFile = (options.file || '').trim();
        if (cleanFile) {
            if (cleanFile.startsWith('-') || cleanFile.includes('\0') || cleanFile.split('/').includes('..')) {
                throw new Error('Invalid file filter');
            }
        }
        const execTarget = this.executor ? cwd : this.expandLocalPath(cwd);
        const fileArgs = cleanFile ? ['--', cleanFile] : [];
        const formatSpec = '__HUG_COMMIT__%H\t%h\t%D\t%an\t%ad\t%ar\t%s';
        const [numstatRaw, nameStatusRaw, allFilesRaw] = await Promise.all([
            this.execGit(execTarget, [
                'log',
                '-n',
                String(limit),
                '--date=iso-strict',
                `--pretty=format:${formatSpec}`,
                '--numstat',
                ...fileArgs,
            ]).catch(() => ''),
            this.execGit(execTarget, [
                'log',
                '-n',
                String(limit),
                '--pretty=format:__HUG_COMMIT__%H',
                '--name-status',
                ...fileArgs,
            ]).catch(() => ''),
            cleanFile
                ? this.execGit(execTarget, [
                    'log',
                    '-n',
                    String(limit),
                    '--pretty=format:',
                    '--name-only',
                ]).catch(() => '')
                : Promise.resolve(''),
        ]);
        const statusByCommit = new Map();
        let currentStatusHash = '';
        for (const rawLine of nameStatusRaw.split('\n')) {
            const line = rawLine.trim();
            if (!line)
                continue;
            if (line.startsWith('__HUG_COMMIT__')) {
                currentStatusHash = line.slice('__HUG_COMMIT__'.length).trim();
                if (!statusByCommit.has(currentStatusHash)) {
                    statusByCommit.set(currentStatusHash, new Map());
                }
                continue;
            }
            if (!currentStatusHash)
                continue;
            const parts = line.split('\t');
            if (parts.length < 2)
                continue;
            const code = parts[0].trim().toUpperCase();
            const filePath = (parts.length >= 3 ? parts[2] : parts[1]).trim();
            const normalizedStatus = code.startsWith('A')
                ? 'A'
                : code.startsWith('D')
                    ? 'D'
                    : code.startsWith('R')
                        ? 'R'
                        : 'M';
            statusByCommit.get(currentStatusHash)?.set(filePath, normalizedStatus);
        }
        const commits = [];
        let currentCommit = null;
        for (const rawLine of numstatRaw.split('\n')) {
            const line = rawLine.trimEnd();
            if (!line.trim())
                continue;
            if (line.startsWith('__HUG_COMMIT__')) {
                const payload = line.slice('__HUG_COMMIT__'.length);
                const [hash = '', shortHash = '', ref = '', author = '', date = '', relativeDate = '', ...subjectParts] = payload.split('\t');
                currentCommit = {
                    hash: hash.trim(),
                    shortHash: shortHash.trim() || hash.trim().slice(0, 7),
                    ref: ref.trim(),
                    subject: subjectParts.join('\t').trim(),
                    author: author.trim(),
                    date: date.trim(),
                    relativeDate: relativeDate.trim(),
                    files: [],
                };
                commits.push(currentCommit);
                continue;
            }
            if (!currentCommit)
                continue;
            const parts = line.split('\t');
            if (parts.length < 3)
                continue;
            const [addStr, delStr, ...restPath] = parts;
            const filePath = normalizeNumstatFilePath(restPath.join('\t'));
            if (!filePath)
                continue;
            const additions = addStr === '-' ? 0 : Number(addStr || 0);
            const deletions = delStr === '-' ? 0 : Number(delStr || 0);
            const st = statusByCommit.get(currentCommit.hash)?.get(filePath) || 'M';
            currentCommit.files.push({
                path: filePath,
                status: st,
                additions: Number.isFinite(additions) ? additions : 0,
                deletions: Number.isFinite(deletions) ? deletions : 0,
            });
        }
        const fileCounts = new Map();
        if (cleanFile && allFilesRaw.trim()) {
            for (const rawLine of allFilesRaw.split('\n')) {
                const fp = rawLine.trim();
                if (!fp)
                    continue;
                fileCounts.set(fp, (fileCounts.get(fp) || 0) + 1);
            }
        }
        else {
            for (const c of commits) {
                for (const f of c.files) {
                    fileCounts.set(f.path, (fileCounts.get(f.path) || 0) + 1);
                }
            }
        }
        const trackedFiles = Array.from(fileCounts.entries()).map(([p, count]) => ({
            path: p,
            count,
        }));
        const q = (options.search || '').trim().toLowerCase();
        const filteredCommits = q
            ? commits.filter(c => c.hash.toLowerCase().includes(q) ||
                c.shortHash.toLowerCase().includes(q) ||
                c.subject.toLowerCase().includes(q) ||
                c.author.toLowerCase().includes(q) ||
                c.files.some(f => f.path.toLowerCase().includes(q)))
            : commits;
        return {
            commits: filteredCommits,
            trackedFiles,
        };
    }
    async getCommitDiff(cwd, commitHash, file) {
        const cleanHash = (commitHash || '').trim();
        if (!/^[0-9a-fA-F]{4,64}$/.test(cleanHash)) {
            throw new Error('Invalid commit hash');
        }
        const cleanFile = (file || '').trim();
        if (cleanFile) {
            if (cleanFile.startsWith('-') || cleanFile.includes('\0') || cleanFile.split('/').includes('..')) {
                throw new Error('Invalid file path');
            }
        }
        const execTarget = this.executor ? cwd : this.expandLocalPath(cwd);
        const args = cleanFile
            ? ['show', '--format=', '--patch', cleanHash, '--', cleanFile]
            : ['show', '--format=', '--patch', cleanHash];
        const raw = await this.execGit(execTarget, args);
        return {
            file: cleanFile || `commit:${cleanHash.slice(0, 7)}`,
            lines: parseDiff(raw, !cleanFile),
        };
    }
}
export const gitService = new GitService();
