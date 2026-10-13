import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import {
  parseSshConfig,
  saveOrUpdateSshConfigHost,
  updateSshConfigHostWorkspace,
  getAvailableSshKeys,
  normalizeWorkspacePath,
  ServerConfig,
} from '../config.js';
import { fsService } from '../services/fsService.js';
import { sessionManager } from '../services/sessionManager.js';
import { sshPool } from '../services/sshPool.js';
import { claudeService } from '../services/claudeService.js';
import { projectService } from '../services/projectService.js';
import { gitService } from '../services/gitService.js';

export const apiRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // --- SERVER ROUTES ---
  fastify.get('/api/servers', async () => {
    const servers = parseSshConfig();
    return {
      servers: servers.map((s) => ({
        ...s,
        isConnected: s.type === 'local' ? true : sshPool.isServerConnected(s.id),
      })),
    };
  });

  fastify.get('/api/ssh-keys', async () => {
    return { keys: getAvailableSshKeys() };
  });

  fastify.post<{ Body: ServerConfig }>('/api/servers', async (request, reply) => {
    const body = request.body;
    if (!body || !body.name || !body.host) {
      return reply.status(400).send({ error: 'Tên server và Host/IP là bắt buộc' });
    }
    const cleanName = body.name.trim().replace(/\s+/g, '-');
    const newServer: ServerConfig = {
      id: `server-ssh-${cleanName}`,
      name: cleanName,
      type: 'ssh',
      label: body.label || `SSH (${cleanName})`,
      host: body.host.trim(),
      user: body.user?.trim() || 'root',
      port: body.port || 22,
      authType: body.authType || (body.password ? 'password' : 'key'),
      key: body.key?.trim(),
      password: body.password?.trim(),
      desc: body.desc || `SSH Host • ${body.user || 'root'}@${body.host}`,
      workspace: normalizeWorkspacePath(body.workspace?.trim() || ((body.user && body.user !== 'root') ? `/home/${body.user}` : '/root')),
      isConnected: false,
    };

    saveOrUpdateSshConfigHost(newServer);
    return { success: true, server: newServer };
  });

  fastify.post<{ Body: { serverId: string; workspace: string } }>('/api/servers/workspace', async (request, reply) => {
    const { serverId, workspace } = request.body || {};
    if (!serverId || !workspace) {
      return reply.status(400).send({ error: 'serverId and workspace are required' });
    }
    const servers = parseSshConfig();
    const target = servers.find((s) => s.id === serverId);
    if (!target) return reply.status(404).send({ error: 'Server not found' });

    updateSshConfigHostWorkspace(target.name, workspace.trim());
    return { success: true, workspace: workspace.trim() };
  });

  fastify.post<{ Body: { serverId: string } }>('/api/servers/disconnect', async (request) => {
    const { serverId } = request.body || {};
    if (serverId && serverId !== 'server-local') {
      sshPool.disconnect(serverId);
    }
    return { success: true };
  });


  // --- PROJECT ROUTES ---
  fastify.get<{ Querystring: { serverId?: string } }>('/api/projects', async (request) => {
    const serverId = request.query.serverId || 'server-local';
    const all = parseSshConfig();
    const server = all.find((s) => s.id === serverId);
    const fallbackRoot = server?.workspace || '~';
    projectService.ensureActiveProject(serverId, fallbackRoot);
    return projectService.list(serverId);
  });

  fastify.post<{ Body: { serverId?: string; rootPath: string; name?: string } }>('/api/projects', async (request, reply) => {
    const { serverId = 'server-local', rootPath, name } = request.body || {};
    if (!rootPath) return reply.status(400).send({ error: 'rootPath is required' });
    const project = projectService.openProject(serverId, rootPath, name);
    return { success: true, project, ...projectService.list(serverId) };
  });

  fastify.post<{ Body: { serverId?: string } }>('/api/projects/home', async (request) => {
    const serverId = request.body?.serverId || 'server-local';
    const project = projectService.openHomeProject(serverId);
    return { success: true, project, ...projectService.list(serverId) };
  });

  fastify.post<{ Params: { id: string }; Body: { serverId?: string } }>('/api/projects/:id/select', async (request, reply) => {
    const serverId = request.body?.serverId || 'server-local';
    const project = projectService.selectProject(serverId, request.params.id);
    if (!project) return reply.status(404).send({ error: 'Project not found' });
    return { success: true, project, ...projectService.list(serverId) };
  });

  fastify.patch<{ Params: { id: string }; Body: { name?: string; rootPath?: string; lastPath?: string } }>('/api/projects/:id', async (request, reply) => {
    const project = projectService.updateProject(request.params.id, request.body || {});
    if (!project) return reply.status(404).send({ error: 'Project not found' });
    return { success: true, project };
  });

  fastify.delete<{ Params: { id: string } }>('/api/projects/:id', async (request, reply) => {
    const ok = projectService.deleteProject(request.params.id);
    if (!ok) return reply.status(404).send({ error: 'Project not found' });
    return { success: true };
  });

  // --- FS ROUTES ---
  fastify.get<{ Querystring: { serverId?: string; projectId?: string; path?: string } }>('/api/fs', async (request, reply) => {
    const serverId = request.query.serverId || 'server-local';
    const projectId = request.query.projectId;
    const relPath = request.query.path || '';
    const project = projectId ? projectService.getProject(projectId) : projectService.getActiveProject(serverId);
    const projectRoot = project?.rootPath;

    if (serverId === 'server-local') {
      try {
        const all = parseSshConfig();
        const localServer = all.find((s) => s.id === 'server-local');
        const data = await fsService.listLocal(relPath, projectRoot || localServer?.workspace);
        return data;
      } catch (err: any) {
        return reply.status(400).send({ error: err.message });
      }
    } else {
      const all = parseSshConfig();
      const target = all.find((s) => s.id === serverId);
      if (!target) return reply.status(404).send({ error: 'Server not found' });

      try {
        const data = await fsService.listRemote(target, relPath, projectRoot);
        return data;
      } catch (err: any) {
        return reply.status(500).send({ error: err.message });
      }
    }
  });

  const handleReadFile = async (request: any, reply: any) => {
    const serverId = request.query.serverId || 'server-local';
    const projectId = request.query.projectId;
    const filePath = request.query.path;
    const project = projectId ? projectService.getProject(projectId) : projectService.getActiveProject(serverId);
    const projectRoot = project?.rootPath;
    if (!filePath) return reply.status(400).send({ error: 'path is required' });

    if (serverId === 'server-local') {
      try {
        const all = parseSshConfig();
        const localServer = all.find((s) => s.id === 'server-local');
        return await fsService.readLocalFile(filePath, projectRoot || localServer?.workspace);
      } catch (err: any) {
        return reply.status(400).send({ error: err.message });
      }
    } else {
      const all = parseSshConfig();
      const target = all.find((s) => s.id === serverId);
      if (!target) return reply.status(404).send({ error: 'Server not found' });

      try {
        return await fsService.readRemoteFile(target, filePath, projectRoot);
      } catch (err: any) {
        return reply.status(500).send({ error: err.message });
      }
    }
  };

  // Support both /api/fs/read and legacy /api/file
  fastify.get<{ Querystring: { serverId?: string; projectId?: string; path: string } }>('/api/fs/read', handleReadFile);
  fastify.get<{ Querystring: { serverId?: string; path: string } }>('/api/file', handleReadFile);

  const handleSaveFile = async (request: any, reply: any) => {
    const { serverId = 'server-local', projectId, path: filePath, content } = request.body || {};
    const project = projectId ? projectService.getProject(projectId) : projectService.getActiveProject(serverId);
    const projectRoot = project?.rootPath;
    if (!filePath) return reply.status(400).send({ error: 'path is required' });

    if (serverId === 'server-local') {
      try {
        const all = parseSshConfig();
        const localServer = all.find((s) => s.id === 'server-local');
        const result = await fsService.writeLocalFile(filePath, content, projectRoot || localServer?.workspace);
        return { success: true, ...result };
      } catch (err: any) {
        return reply.status(400).send({ error: err.message });
      }
    } else {
      const all = parseSshConfig();
      const target = all.find((s) => s.id === serverId);
      if (!target) return reply.status(404).send({ error: 'Server not found' });

      try {
        const result = await fsService.writeRemoteFile(target, filePath, content, projectRoot);
        return { success: true, ...result };
      } catch (err: any) {
        return reply.status(500).send({ error: err.message });
      }
    }
  };

  // Support both /api/fs/save and legacy /api/file
  fastify.post<{ Body: { serverId?: string; projectId?: string; path: string; content: string } }>('/api/fs/save', handleSaveFile);
  fastify.post<{ Body: { serverId?: string; path: string; content: string } }>('/api/file', handleSaveFile);

  fastify.post<{
    Body: {
      action: 'create' | 'delete' | 'rename';
      serverId?: string;
      projectId?: string;
      path?: string;
      type?: 'file' | 'dir';
      oldPath?: string;
      newPath?: string;
    };
  }>('/api/fs/action', async (request, reply) => {
    const { action, serverId = 'server-local', projectId, path: itemPath, type = 'file', oldPath, newPath } =
      request.body || {};
    const project = projectId ? projectService.getProject(projectId) : projectService.getActiveProject(serverId);
    const projectRoot = project?.rootPath;

    if (serverId === 'server-local') {
      try {
        const all = parseSshConfig();
        const localServer = all.find((s) => s.id === 'server-local');
        const ws = projectRoot || localServer?.workspace;
        if (action === 'create') {
          if (!itemPath) return reply.status(400).send({ error: 'path required' });
          await fsService.createLocal(itemPath, type, ws);
        } else if (action === 'delete') {
          if (!itemPath) return reply.status(400).send({ error: 'path required' });
          await fsService.deleteLocal(itemPath, ws);
        } else if (action === 'rename') {
          if (!oldPath || !newPath) return reply.status(400).send({ error: 'oldPath and newPath required' });
          await fsService.renameLocal(oldPath, newPath, ws);
        }
        return { success: true };
      } catch (err: any) {
        return reply.status(400).send({ error: err.message });
      }
    } else {
      return reply.status(501).send({ error: 'Remote FS actions not yet supported for remote server' });
    }
  });

  // --- SESSIONS ---
  fastify.get<{ Querystring: { serverId?: string } }>('/api/sessions', async (request) => {
    return { sessions: sessionManager.list(request.query.serverId) };
  });

  fastify.delete<{ Params: { id: string } }>('/api/sessions/:id', async (request) => {
    sessionManager.close(request.params.id);
    return { success: true };
  });

  // --- CLAUDE SESSIONS & CHAT ---
  fastify.get('/api/claude/models', async () => {
    return { success: true, models: claudeService.getModelOptions(), defaultModel: 'Default Medium' };
  });

  fastify.get<{ Querystring: { serverId?: string; projectId?: string; defaultCwd?: string } }>('/api/claude/sessions', async (request) => {
    const serverId = request.query.serverId || 'server-local';
    const projectId = request.query.projectId || '';
    const defaultCwd = request.query.defaultCwd || '';
    const sessions = claudeService.getSessionsForServer(serverId, defaultCwd, projectId);
    return { sessions };
  });

  fastify.post<{
    Body: {
      serverId: string;
      projectId?: string;
      name?: string;
      cwd?: string;
      model?: string;
      mode?: string;
      initialPrompt?: string;
      bypassPermissions?: boolean;
    };
  }>('/api/claude/sessions', async (request, reply) => {
    const { serverId, projectId, name, cwd, model, mode, initialPrompt, bypassPermissions } = request.body || {};
    if (!serverId) {
      return reply.status(400).send({ error: 'serverId is required' });
    }
    const session = claudeService.createSession(
      serverId,
      projectId || '',
      name || 'chat',
      cwd || '',
      model,
      mode,
      initialPrompt,
      Boolean(bypassPermissions)
    );
    return { success: true, session };
  });

  fastify.patch<{
    Params: { id: string };
    Body: {
      name?: string;
      cwd?: string;
      model?: string;
      mode?: string;
      bypassPermissions?: boolean;
      timer?: string;
      contextTokens?: string;
    };
  }>('/api/claude/sessions/:id', async (request, reply) => {
    const session = claudeService.updateSession(request.params.id, request.body || {});
    if (!session) return reply.status(404).send({ error: 'Session not found' });
    return { success: true, session };
  });

  fastify.delete<{ Params: { id: string } }>('/api/claude/sessions/:id', async (request, reply) => {
    const ok = claudeService.deleteSession(request.params.id);
    if (!ok) return reply.status(404).send({ error: 'Session not found' });
    return { success: true };
  });

  fastify.post<{
    Params: { id: string };
    Body: { prompt: string };
  }>('/api/claude/sessions/:id/messages', async (request, reply) => {
    const { id } = request.params;
    const { prompt } = request.body || {};
    if (!prompt || !prompt.trim()) {
      return reply.status(400).send({ error: 'prompt is required' });
    }

    const session = claudeService.getSession(id);
    if (!session) return reply.status(404).send({ error: 'Session not found' });

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    // 1. Add user message
    const userMsg = {
      id: `msg-${Date.now()}-u`,
      sender: 'user' as const,
      text: prompt.trim(),
      time: timeStr,
    };
    claudeService.addMessage(id, userMsg);

    // 2. Execute Claude CLI / agent asynchronously
    const assistantResult = await claudeService.runClaudePrompt(session, prompt.trim(), () => {});

    // 3. Add assistant message
    const asstMsg = {
      id: `msg-${Date.now()}-a`,
      sender: 'assistant' as const,
      text: assistantResult.text,
      time: timeStr,
      tools: assistantResult.tools,
    };
    const updated = claudeService.addMessage(id, asstMsg);

    return {
      success: true,
      userMessage: userMsg,
      assistantMessage: asstMsg,
      session: updated,
    };
  });

  fastify.post<{
    Params: { id: string };
    Body: { prompt: string };
  }>('/api/claude/sessions/:id/messages/stream', async (request, reply) => {
    const { id } = request.params;
    const { prompt } = request.body || {};
    if (!prompt || !prompt.trim()) {
      return reply.status(400).send({ error: 'prompt is required' });
    }

    const session = claudeService.getSession(id);
    if (!session) return reply.status(404).send({ error: 'Session not found' });

    reply.raw.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    reply.raw.setHeader('Cache-Control', 'no-cache, no-transform');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.setHeader('X-Accel-Buffering', 'no');
    reply.raw.flushHeaders?.();

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    // Add user message to session
    const userMsg = {
      id: `msg-${Date.now()}-u`,
      sender: 'user' as const,
      text: prompt.trim(),
      time: timeStr,
    };
    claudeService.addMessage(id, userMsg);

    const sendEvent = (data: any) => {
      try {
        reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
      } catch (_) {}
    };

    try {
      const result = await claudeService.streamClaudePrompt(session, prompt.trim(), (ev) => {
        sendEvent(ev);
      });

      // Add assistant message to session
      const asstMsg = {
        id: `msg-${Date.now()}-a`,
        sender: 'assistant' as const,
        text: result.text,
        time: timeStr,
        thinking: result.thinking,
        tools: result.tools,
      };
      claudeService.addMessage(id, asstMsg);

      sendEvent({ type: 'finish', userMessage: userMsg, assistantMessage: asstMsg });
    } catch (err: any) {
      sendEvent({ type: 'error', error: err.message || 'Stream error' });
    } finally {
      reply.raw.write(`data: [DONE]\n\n`);
      reply.raw.end();
    }
  });

  fastify.post<{ Params: { id: string } }>('/api/claude/sessions/:id/cancel', async (request) => {
    const cancelled = claudeService.cancelRun(request.params.id);
    return { success: true, cancelled };
  });

  fastify.post<{ Params: { id: string } }>('/api/claude/sessions/:id/clear', async (request, reply) => {
    const session = claudeService.clearMessages(request.params.id);
    if (!session) return reply.status(404).send({ error: 'Session not found' });
    return { success: true, session };
  });

  fastify.get('/api/claude/limits', async () => {
    return {
      limits: claudeService.getLimits(),
    };
  });


  // --- GIT ---
  fastify.get<{ Querystring: { serverId?: string; projectId?: string } }>('/api/git/status', async (request, reply) => {
    const serverId = request.query.serverId || 'server-local';
    if (serverId !== 'server-local') return reply.status(501).send({ error: 'Remote Git is not supported yet' });
    const project = request.query.projectId ? projectService.getProject(request.query.projectId) : projectService.getActiveProject(serverId);
    if (!project) return reply.status(404).send({ error: 'Project not found' });
    try {
      return await gitService.getStatus(project.rootPath);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  fastify.get<{ Querystring: { serverId?: string; projectId?: string; file?: string } }>('/api/git/diff', async (request, reply) => {
    const serverId = request.query.serverId || 'server-local';
    if (serverId !== 'server-local') return reply.status(501).send({ error: 'Remote Git is not supported yet' });
    const project = request.query.projectId ? projectService.getProject(request.query.projectId) : projectService.getActiveProject(serverId);
    if (!project) return reply.status(404).send({ error: 'Project not found' });
    const file = request.query.file || '';
    if (!file) return reply.status(400).send({ error: 'file is required' });
    try {
      return await gitService.getDiff(project.rootPath, file);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  function getLocalGitProject(serverId: string, projectId?: string) {
    if (serverId !== 'server-local') return { error: 'Remote Git is not supported yet' } as const;
    const project = projectId ? projectService.getProject(projectId) : projectService.getActiveProject(serverId);
    if (!project) return { error: 'Project not found' } as const;
    return { project } as const;
  }

  fastify.get<{ Querystring: { serverId?: string; projectId?: string } }>('/api/git/branches', async (request, reply) => {
    const serverId = request.query.serverId || 'server-local';
    const target = getLocalGitProject(serverId, request.query.projectId);
    if ('error' in target) return reply.status((target.error || '').includes('Remote') ? 501 : 404).send({ error: target.error });
    try {
      return { branches: await gitService.getBranches(target.project.rootPath) };
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  fastify.post<{ Body: { serverId?: string; projectId?: string; branch?: string } }>('/api/git/checkout', async (request, reply) => {
    const serverId = request.body?.serverId || 'server-local';
    const target = getLocalGitProject(serverId, request.body?.projectId);
    if ('error' in target) return reply.status((target.error || '').includes('Remote') ? 501 : 404).send({ error: target.error });
    const branch = request.body?.branch || '';
    if (!branch.trim()) return reply.status(400).send({ error: 'branch is required' });
    try {
      await gitService.checkout(target.project.rootPath, branch);
      return { success: true, status: await gitService.getStatus(target.project.rootPath), branches: await gitService.getBranches(target.project.rootPath) };
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  fastify.post<{ Body: { serverId?: string; projectId?: string } }>('/api/git/pull', async (request, reply) => {
    const serverId = request.body?.serverId || 'server-local';
    const target = getLocalGitProject(serverId, request.body?.projectId);
    if ('error' in target) return reply.status((target.error || '').includes('Remote') ? 501 : 404).send({ error: target.error });
    try {
      const output = await gitService.pull(target.project.rootPath);
      return { success: true, output, status: await gitService.getStatus(target.project.rootPath), branches: await gitService.getBranches(target.project.rootPath) };
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  fastify.post<{ Body: { serverId?: string; projectId?: string } }>('/api/git/push', async (request, reply) => {
    const serverId = request.body?.serverId || 'server-local';
    const target = getLocalGitProject(serverId, request.body?.projectId);
    if ('error' in target) return reply.status((target.error || '').includes('Remote') ? 501 : 404).send({ error: target.error });
    try {
      const output = await gitService.push(target.project.rootPath);
      return { success: true, output, status: await gitService.getStatus(target.project.rootPath), branches: await gitService.getBranches(target.project.rootPath) };
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  fastify.post<{ Body: { serverId?: string; projectId?: string; file?: string } }>('/api/git/stage', async (request, reply) => {
    const serverId = request.body?.serverId || 'server-local';
    if (serverId !== 'server-local') return reply.status(501).send({ error: 'Remote Git is not supported yet' });
    const project = request.body?.projectId ? projectService.getProject(request.body.projectId) : projectService.getActiveProject(serverId);
    if (!project) return reply.status(404).send({ error: 'Project not found' });
    const file = request.body?.file || '';
    if (!file) return reply.status(400).send({ error: 'file is required' });
    try {
      await gitService.stage(project.rootPath, file);
      return { success: true, status: await gitService.getStatus(project.rootPath) };
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  fastify.post<{ Body: { serverId?: string; projectId?: string; file?: string } }>('/api/git/unstage', async (request, reply) => {
    const serverId = request.body?.serverId || 'server-local';
    if (serverId !== 'server-local') return reply.status(501).send({ error: 'Remote Git is not supported yet' });
    const project = request.body?.projectId ? projectService.getProject(request.body.projectId) : projectService.getActiveProject(serverId);
    if (!project) return reply.status(404).send({ error: 'Project not found' });
    const file = request.body?.file || '';
    if (!file) return reply.status(400).send({ error: 'file is required' });
    try {
      await gitService.unstage(project.rootPath, file);
      return { success: true, status: await gitService.getStatus(project.rootPath) };
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  fastify.post<{ Body: { serverId?: string; projectId?: string; message?: string } }>('/api/git/commit', async (request, reply) => {
    const serverId = request.body?.serverId || 'server-local';
    if (serverId !== 'server-local') return reply.status(501).send({ error: 'Remote Git is not supported yet' });
    const project = request.body?.projectId ? projectService.getProject(request.body.projectId) : projectService.getActiveProject(serverId);
    if (!project) return reply.status(404).send({ error: 'Project not found' });
    const message = request.body?.message || '';
    if (!message.trim()) return reply.status(400).send({ error: 'Commit message is required' });
    try {
      const output = await gitService.commit(project.rootPath, message);
      return { success: true, output, status: await gitService.getStatus(project.rootPath) };
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  fastify.post<{
    Body: {
      rawText?: string;
      fiveHour?: { usedPercent?: number; resetIn?: string };
      weekly?: { usedPercent?: number; resetIn?: string };
    };
  }>('/api/claude/limits', async (request) => {
    const updated = claudeService.updateLimits(request.body || {});
    return { success: true, limits: updated };
  });
};
