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

  // --- FS ROUTES ---
  fastify.get<{ Querystring: { serverId?: string; path?: string } }>('/api/fs', async (request, reply) => {
    const serverId = request.query.serverId || 'server-local';
    const relPath = request.query.path || '';

    if (serverId === 'server-local') {
      try {
        const all = parseSshConfig();
        const localServer = all.find((s) => s.id === 'server-local');
        const data = await fsService.listLocal(relPath, localServer?.workspace);
        return data;
      } catch (err: any) {
        return reply.status(400).send({ error: err.message });
      }
    } else {
      const all = parseSshConfig();
      const target = all.find((s) => s.id === serverId);
      if (!target) return reply.status(404).send({ error: 'Server not found' });

      try {
        const data = await fsService.listRemote(target, relPath);
        return data;
      } catch (err: any) {
        return reply.status(500).send({ error: err.message });
      }
    }
  });

  const handleReadFile = async (request: any, reply: any) => {
    const serverId = request.query.serverId || 'server-local';
    const filePath = request.query.path;
    if (!filePath) return reply.status(400).send({ error: 'path is required' });

    if (serverId === 'server-local') {
      try {
        const all = parseSshConfig();
        const localServer = all.find((s) => s.id === 'server-local');
        return await fsService.readLocalFile(filePath, localServer?.workspace);
      } catch (err: any) {
        return reply.status(400).send({ error: err.message });
      }
    } else {
      const all = parseSshConfig();
      const target = all.find((s) => s.id === serverId);
      if (!target) return reply.status(404).send({ error: 'Server not found' });

      try {
        return await fsService.readRemoteFile(target, filePath);
      } catch (err: any) {
        return reply.status(500).send({ error: err.message });
      }
    }
  };

  // Support both /api/fs/read and legacy /api/file
  fastify.get<{ Querystring: { serverId?: string; path: string } }>('/api/fs/read', handleReadFile);
  fastify.get<{ Querystring: { serverId?: string; path: string } }>('/api/file', handleReadFile);

  const handleSaveFile = async (request: any, reply: any) => {
    const { serverId = 'server-local', path: filePath, content } = request.body || {};
    if (!filePath) return reply.status(400).send({ error: 'path is required' });

    if (serverId === 'server-local') {
      try {
        const all = parseSshConfig();
        const localServer = all.find((s) => s.id === 'server-local');
        const result = await fsService.writeLocalFile(filePath, content, localServer?.workspace);
        return { success: true, ...result };
      } catch (err: any) {
        return reply.status(400).send({ error: err.message });
      }
    } else {
      const all = parseSshConfig();
      const target = all.find((s) => s.id === serverId);
      if (!target) return reply.status(404).send({ error: 'Server not found' });

      try {
        const result = await fsService.writeRemoteFile(target, filePath, content);
        return { success: true, ...result };
      } catch (err: any) {
        return reply.status(500).send({ error: err.message });
      }
    }
  };

  // Support both /api/fs/save and legacy /api/file
  fastify.post<{ Body: { serverId?: string; path: string; content: string } }>('/api/fs/save', handleSaveFile);
  fastify.post<{ Body: { serverId?: string; path: string; content: string } }>('/api/file', handleSaveFile);

  fastify.post<{
    Body: {
      action: 'create' | 'delete' | 'rename';
      serverId?: string;
      path?: string;
      type?: 'file' | 'dir';
      oldPath?: string;
      newPath?: string;
    };
  }>('/api/fs/action', async (request, reply) => {
    const { action, serverId = 'server-local', path: itemPath, type = 'file', oldPath, newPath } =
      request.body || {};

    if (serverId === 'server-local') {
      try {
        const all = parseSshConfig();
        const localServer = all.find((s) => s.id === 'server-local');
        const ws = localServer?.workspace;
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
  fastify.get<{ Querystring: { serverId?: string; defaultCwd?: string } }>('/api/claude/sessions', async (request) => {
    const serverId = request.query.serverId || 'server-local';
    const defaultCwd = request.query.defaultCwd || '';
    const sessions = claudeService.getSessionsForServer(serverId, defaultCwd);
    return { sessions };
  });

  fastify.post<{
    Body: {
      serverId: string;
      name?: string;
      cwd?: string;
      model?: string;
      mode?: string;
      initialPrompt?: string;
      bypassPermissions?: boolean;
    };
  }>('/api/claude/sessions', async (request, reply) => {
    const { serverId, name, cwd, model, mode, initialPrompt, bypassPermissions } = request.body || {};
    if (!serverId) {
      return reply.status(400).send({ error: 'serverId is required' });
    }
    const session = claudeService.createSession(
      serverId,
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
