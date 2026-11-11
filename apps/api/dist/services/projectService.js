import fs from 'fs';
import os from 'os';
import path from 'path';
import { createHash } from 'crypto';
import { normalizeWorkspacePath, parseSshConfig } from '../config.js';
const DEFAULT_PROJECTS_FILE = path.join(os.homedir(), '.config', 'hugremote', 'projects.json');
function slugPart(value) {
    return (value || 'project')
        .trim()
        .replace(/^~$/, 'home')
        .replace(/[^a-zA-Z0-9._-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80) || 'project';
}
export function basenameForProject(rootPath) {
    if (!rootPath || rootPath === '~')
        return '~';
    const clean = rootPath.replace(/\/+$/, '');
    if (!clean || clean === '/')
        return 'root';
    return path.posix.basename(clean) || path.basename(clean) || 'root';
}
export function resolveProjectWorkspacePath(serverId, rootPath) {
    const trimmed = (rootPath || '~').trim() || '~';
    if (!serverId || serverId === 'server-local') {
        return normalizeWorkspacePath(trimmed);
    }
    // On macOS, os.homedir() is /Users/<user>, which does not exist on remote Linux SSH servers.
    // Keep '~' or '~/...' intact for remote servers so remote SFTP/Git/Claude/Terminal resolve it on the remote host.
    const localHome = os.homedir();
    let normalized = trimmed;
    if (localHome.startsWith('/Users/') && (trimmed === localHome || trimmed.startsWith(localHome + '/'))) {
        const rel = trimmed.slice(localHome.length).replace(/^\/+/, '');
        normalized = rel ? `~/${rel}` : '~';
    }
    if (normalized === '~' || normalized === '~/')
        return '~';
    if (normalized.startsWith('~/')) {
        const cleanSub = path.posix.normalize(normalized.slice(2)).replace(/\/+$/, '');
        return cleanSub && cleanSub !== '.' ? `~/${cleanSub}` : '~';
    }
    // Check if remote server's home/workspace matches normalized path
    try {
        const servers = parseSshConfig();
        const srv = servers.find((s) => s.id === serverId);
        if (srv) {
            const userHome = srv.user && srv.user !== 'root' ? `/home/${srv.user}` : '/root';
            const ws = (srv.workspace || userHome).trim().replace(/\/+$/, '') || userHome;
            const cleanNorm = normalized.replace(/\/+$/, '');
            if (cleanNorm === ws || cleanNorm === userHome) {
                return '~';
            }
            if (cleanNorm.startsWith(ws + '/')) {
                const sub = cleanNorm.slice(ws.length + 1).replace(/\/+$/, '');
                return sub ? `~/${sub}` : '~';
            }
            if (cleanNorm.startsWith(userHome + '/')) {
                const sub = cleanNorm.slice(userHome.length + 1).replace(/\/+$/, '');
                return sub ? `~/${sub}` : '~';
            }
        }
    }
    catch (_) { }
    const cleanPosix = path.posix.normalize(normalized).replace(/\/+$/, '');
    return cleanPosix || '/';
}
export function canonicalProjectPath(serverId, rootPath) {
    const resolved = resolveProjectWorkspacePath(serverId, rootPath);
    if (!serverId || serverId === 'server-local') {
        return path.resolve(resolved);
    }
    return resolved.replace(/\/+$/, '') || '/';
}
export function isHomeProject(project) {
    const norm = (project.rootPath || '').trim().replace(/\/+$/, '') || '/';
    if (norm === '~')
        return true;
    if (!project.serverId || project.serverId === 'server-local') {
        const resolved = path.resolve(normalizeWorkspacePath(norm));
        return resolved === path.resolve(os.homedir());
    }
    return false;
}
export class ProjectService {
    filePath;
    state = { activeProjectByServer: {}, projects: [] };
    constructor(filePath = process.env.HUGCODE_PROJECTS_FILE || DEFAULT_PROJECTS_FILE) {
        this.filePath = filePath;
        this.load();
    }
    getWorkspaceServers() {
        const ids = Array.isArray(this.state.workspaceServerIds) ? this.state.workspaceServerIds : [];
        if (!ids.includes('server-local')) {
            return ['server-local', ...ids];
        }
        return ids;
    }
    setWorkspaceServers(ids) {
        const list = Array.isArray(ids) ? ids.map(s => String(s).trim()).filter(Boolean) : ['server-local'];
        if (!list.includes('server-local')) {
            list.unshift('server-local');
        }
        this.state.workspaceServerIds = list;
        this.save();
        return list;
    }
    resetForTests(filePath) {
        this.filePath = filePath || process.env.HUGCODE_PROJECTS_FILE || DEFAULT_PROJECTS_FILE;
        this.state = { activeProjectByServer: {}, projects: [] };
        this.save();
    }
    load() {
        try {
            if (!fs.existsSync(this.filePath))
                return;
            const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
            this.state = {
                activeProjectByServer: parsed.activeProjectByServer || {},
                projects: Array.isArray(parsed.projects) ? parsed.projects : [],
                workspaceServerIds: Array.isArray(parsed.workspaceServerIds) ? parsed.workspaceServerIds : ['server-local'],
            };
            // Older IDs used only the first ten base64 characters of the path.
            // Keep the first record's ID for existing references; repair colliding
            // records using their full path while preserving the active selection.
            const seen = new Set();
            let repaired = false;
            for (const project of this.state.projects) {
                if (project.serverId && project.serverId !== 'server-local') {
                    const fixedRoot = resolveProjectWorkspacePath(project.serverId, project.rootPath);
                    if (fixedRoot !== project.rootPath) {
                        project.rootPath = fixedRoot;
                        repaired = true;
                    }
                }
                if (seen.has(project.id)) {
                    project.id = this.uniqueProjectId(project.serverId, project.name, project.rootPath, seen);
                    repaired = true;
                }
                seen.add(project.id);
            }
            // Deduplicate projects per server pointing to the same canonical path
            const seenCanonicalByServer = new Map();
            const deduplicated = [];
            for (const project of this.state.projects) {
                const sId = project.serverId || 'server-local';
                const key = `${sId}:${canonicalProjectPath(sId, project.rootPath)}`;
                const existing = seenCanonicalByServer.get(key);
                if (existing) {
                    if (project.updatedAt > existing.updatedAt)
                        existing.updatedAt = project.updatedAt;
                    if (this.state.activeProjectByServer[sId] === project.id) {
                        this.state.activeProjectByServer[sId] = existing.id;
                    }
                    repaired = true;
                    continue;
                }
                if (!isHomeProject(project) && project.name === '~') {
                    project.name = basenameForProject(project.rootPath);
                    repaired = true;
                }
                seenCanonicalByServer.set(key, project);
                deduplicated.push(project);
            }
            this.state.projects = deduplicated;
            if (repaired)
                this.save();
        }
        catch (err) {
            console.warn('Failed to load projects config:', err);
            this.state = { activeProjectByServer: {}, projects: [] };
        }
    }
    save() {
        const dir = path.dirname(this.filePath);
        if (!fs.existsSync(dir))
            fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
        fs.writeFileSync(this.filePath, JSON.stringify(this.state, null, 2), { mode: 0o600 });
    }
    list(serverId) {
        const projects = this.state.projects
            .filter((p) => p.serverId === serverId);
        return {
            activeProjectId: this.state.activeProjectByServer[serverId] || projects[0]?.id || '',
            projects,
        };
    }
    getProject(projectId) {
        if (!projectId)
            return undefined;
        return this.state.projects.find((p) => p.id === projectId);
    }
    getActiveProject(serverId) {
        const activeId = this.state.activeProjectByServer[serverId];
        return this.getProject(activeId) || this.state.projects.find((p) => p.serverId === serverId);
    }
    ensureActiveProject(serverId, fallbackRoot) {
        const current = this.getActiveProject(serverId);
        if (current)
            return current;
        return this.openProject(serverId, fallbackRoot || '~');
    }
    openHomeProject(serverId) {
        return this.openProject(serverId, '~', '~');
    }
    uniqueProjectId(serverId, name, rootPath, taken = new Set(this.state.projects.map(p => p.id))) {
        const digest = createHash('sha256').update(rootPath).digest('hex');
        const base = `${serverId}:${slugPart(name)}:${digest}`;
        let id = base;
        for (let suffix = 2; taken.has(id); suffix++)
            id = `${base}:${suffix}`;
        return id;
    }
    isHome(project) {
        return isHomeProject(project);
    }
    findMatchingProject(serverId, rootPath) {
        const canonicalTarget = canonicalProjectPath(serverId, rootPath);
        const targetIsHome = canonicalTarget === path.resolve(os.homedir()) || canonicalTarget === '~';
        return this.state.projects.find((p) => {
            if (p.serverId !== serverId)
                return false;
            if (targetIsHome && isHomeProject(p))
                return true;
            const canonicalP = canonicalProjectPath(serverId, p.rootPath);
            return canonicalP === canonicalTarget;
        });
    }
    openProject(serverId, rootPath, name) {
        const normalizedRoot = resolveProjectWorkspacePath(serverId, rootPath || '~');
        const existing = this.findMatchingProject(serverId, normalizedRoot);
        if (existing) {
            if (name && name.trim() && name.trim() !== '~' && existing.name === '~') {
                existing.name = name.trim();
            }
            existing.updatedAt = Date.now();
            this.state.activeProjectByServer[serverId] = existing.id;
            this.save();
            return existing;
        }
        const isTargetHome = isHomeProject({ serverId, rootPath: normalizedRoot, name: '', id: '', updatedAt: 0 });
        const defaultName = isTargetHome ? '~' : basenameForProject(normalizedRoot);
        const projectName = (name || defaultName).trim() || defaultName;
        const id = this.uniqueProjectId(serverId, projectName, normalizedRoot);
        const project = {
            id,
            serverId,
            name: projectName,
            rootPath: normalizedRoot,
            lastPath: '',
            updatedAt: Date.now(),
        };
        this.state.projects.push(project);
        this.state.activeProjectByServer[serverId] = project.id;
        this.save();
        return project;
    }
    selectProject(serverId, projectId) {
        const project = this.state.projects.find((p) => p.id === projectId && p.serverId === serverId);
        if (!project)
            return undefined;
        this.state.activeProjectByServer[serverId] = project.id;
        this.save();
        return project;
    }
    updateProject(projectId, updates) {
        const project = this.getProject(projectId);
        if (!project)
            return undefined;
        if (updates.name !== undefined) {
            const cleanName = updates.name.trim();
            if (cleanName) {
                if (cleanName === '~' && !isHomeProject(project)) {
                    // Do not allow non-home project to be renamed '~'
                }
                else {
                    project.name = cleanName;
                }
            }
        }
        if (updates.rootPath !== undefined) {
            const newRoot = resolveProjectWorkspacePath(project.serverId, updates.rootPath);
            project.rootPath = newRoot;
            if (!isHomeProject(project) && project.name === '~') {
                project.name = basenameForProject(newRoot);
            }
        }
        if (updates.lastPath !== undefined)
            project.lastPath = updates.lastPath;
        project.updatedAt = Date.now();
        this.save();
        return project;
    }
    deleteProject(projectId) {
        const idx = this.state.projects.findIndex((p) => p.id === projectId);
        if (idx === -1)
            return false;
        const target = this.state.projects[idx];
        if (isHomeProject(target))
            return false;
        const [removed] = this.state.projects.splice(idx, 1);
        if (this.state.activeProjectByServer[removed.serverId] === projectId) {
            const next = this.state.projects.find((p) => p.serverId === removed.serverId && isHomeProject(p)) ||
                this.openHomeProject(removed.serverId);
            this.state.activeProjectByServer[removed.serverId] = next.id;
        }
        this.save();
        return true;
    }
    resolveProjectPath(projectId, relPath = '') {
        const project = this.getProject(projectId);
        if (!project)
            return { ok: false, error: 'Project not found' };
        const root = normalizeWorkspacePath(project.rootPath);
        const target = path.resolve(root, relPath || '.');
        const rootResolved = path.resolve(root);
        const rootWithSep = rootResolved.endsWith(path.sep) ? rootResolved : rootResolved + path.sep;
        if (target !== rootResolved && !target.startsWith(rootWithSep)) {
            return { ok: false, error: 'Path is outside project root' };
        }
        return { ok: true, path: target, project };
    }
}
export const projectService = new ProjectService();
