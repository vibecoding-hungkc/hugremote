import fs from 'fs';
import os from 'os';
import path from 'path';
import { normalizeWorkspacePath } from '../config.js';
const DEFAULT_PROJECTS_FILE = path.join(os.homedir(), '.config', 'hugremote', 'projects.json');
function slugPart(value) {
    return (value || 'project')
        .trim()
        .replace(/^~$/, 'home')
        .replace(/[^a-zA-Z0-9._-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80) || 'project';
}
function basenameForProject(rootPath) {
    if (!rootPath || rootPath === '~')
        return '~';
    const clean = rootPath.replace(/\/+$/, '');
    return path.posix.basename(clean) || path.basename(clean) || '~';
}
function isHomeProject(project) {
    return project.name === '~' || path.resolve(project.rootPath) === path.resolve(os.homedir());
}
export class ProjectService {
    filePath;
    state = { activeProjectByServer: {}, projects: [] };
    constructor(filePath = process.env.HUGCODE_PROJECTS_FILE || DEFAULT_PROJECTS_FILE) {
        this.filePath = filePath;
        this.load();
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
            };
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
            .filter((p) => p.serverId === serverId)
            .sort((a, b) => b.updatedAt - a.updatedAt);
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
    openProject(serverId, rootPath, name) {
        const normalizedRoot = normalizeWorkspacePath(rootPath || '~');
        const projectName = (name || basenameForProject(rootPath || normalizedRoot)).trim() || '~';
        const existing = this.state.projects.find((p) => p.serverId === serverId && p.rootPath === normalizedRoot);
        if (existing) {
            existing.name = projectName;
            existing.updatedAt = Date.now();
            this.state.activeProjectByServer[serverId] = existing.id;
            this.save();
            return existing;
        }
        const id = `${serverId}:${slugPart(projectName)}:${Buffer.from(normalizedRoot).toString('base64url').slice(0, 10)}`;
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
        project.updatedAt = Date.now();
        this.state.activeProjectByServer[serverId] = project.id;
        this.save();
        return project;
    }
    updateProject(projectId, updates) {
        const project = this.getProject(projectId);
        if (!project)
            return undefined;
        if (updates.name !== undefined)
            project.name = updates.name.trim() || project.name;
        if (updates.rootPath !== undefined)
            project.rootPath = normalizeWorkspacePath(updates.rootPath);
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
