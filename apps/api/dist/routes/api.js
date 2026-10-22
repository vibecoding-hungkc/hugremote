import fs from 'fs';
import path from 'path';
import { parseSshConfig, saveOrUpdateSshConfigHost, updateSshConfigHostWorkspace, getAvailableSshKeys, normalizeWorkspacePath, } from '../config.js';
import { fsService } from '../services/fsService.js';
import { sessionManager } from '../services/sessionManager.js';
import { sshPool } from '../services/sshPool.js';
import { claudeService } from '../services/claudeService.js';
import { projectService } from '../services/projectService.js';
import { createGitService } from '../services/gitService.js';
import { tempZipService } from '../services/tempZipService.js';
export const apiRoutes = async (fastify) => {
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
    fastify.post('/api/servers', async (request, reply) => {
        const body = request.body;
        if (!body || !body.name || !body.host) {
            return reply.status(400).send({ error: 'Tên server và Host/IP là bắt buộc' });
        }
        const cleanName = body.name.trim().replace(/\s+/g, '-');
        const newServer = {
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
    fastify.post('/api/servers/workspace', async (request, reply) => {
        const { serverId, workspace } = request.body || {};
        if (!serverId || !workspace) {
            return reply.status(400).send({ error: 'serverId and workspace are required' });
        }
        const servers = parseSshConfig();
        const target = servers.find((s) => s.id === serverId);
        if (!target)
            return reply.status(404).send({ error: 'Server not found' });
        updateSshConfigHostWorkspace(target.name, workspace.trim());
        return { success: true, workspace: workspace.trim() };
    });
    fastify.post('/api/servers/disconnect', async (request) => {
        const { serverId } = request.body || {};
        if (serverId && serverId !== 'server-local') {
            sshPool.disconnect(serverId);
        }
        return { success: true };
    });
    // --- PROJECT ROUTES ---
    fastify.get('/api/projects', async (request) => {
        const serverId = request.query.serverId || 'server-local';
        const all = parseSshConfig();
        const server = all.find((s) => s.id === serverId);
        const fallbackRoot = server?.workspace || '~';
        projectService.ensureActiveProject(serverId, fallbackRoot);
        return projectService.list(serverId);
    });
    fastify.post('/api/projects', async (request, reply) => {
        const { serverId = 'server-local', rootPath, name } = request.body || {};
        if (!rootPath)
            return reply.status(400).send({ error: 'rootPath is required' });
        const project = projectService.openProject(serverId, rootPath, name);
        return { success: true, project, ...projectService.list(serverId) };
    });
    fastify.post('/api/projects/home', async (request) => {
        const serverId = request.body?.serverId || 'server-local';
        const project = projectService.openHomeProject(serverId);
        return { success: true, project, ...projectService.list(serverId) };
    });
    fastify.post('/api/projects/:id/select', async (request, reply) => {
        const serverId = request.body?.serverId || 'server-local';
        const project = projectService.selectProject(serverId, request.params.id);
        if (!project)
            return reply.status(404).send({ error: 'Project not found' });
        return { success: true, project, ...projectService.list(serverId) };
    });
    fastify.patch('/api/projects/:id', async (request, reply) => {
        if (request.body?.name !== undefined && request.body.name.trim() === '~') {
            return reply.status(400).send({ error: 'Project name "~" is reserved' });
        }
        const project = projectService.updateProject(request.params.id, request.body || {});
        if (!project)
            return reply.status(404).send({ error: 'Project not found' });
        return { success: true, project };
    });
    fastify.delete('/api/projects/:id', async (request, reply) => {
        const ok = projectService.deleteProject(request.params.id);
        if (!ok)
            return reply.status(404).send({ error: 'Project not found' });
        return { success: true };
    });
    // --- FS ROUTES ---
    fastify.get('/api/fs', async (request, reply) => {
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
            }
            catch (err) {
                return reply.status(400).send({ error: err.message });
            }
        }
        else {
            const all = parseSshConfig();
            const target = all.find((s) => s.id === serverId);
            if (!target)
                return reply.status(404).send({ error: 'Server not found' });
            try {
                const data = await fsService.listRemote(target, relPath, projectRoot);
                return data;
            }
            catch (err) {
                return reply.status(500).send({ error: err.message });
            }
        }
    });
    const handleReadFile = async (request, reply) => {
        const serverId = request.query.serverId || 'server-local';
        const projectId = request.query.projectId;
        const filePath = request.query.path;
        const project = projectId ? projectService.getProject(projectId) : projectService.getActiveProject(serverId);
        const projectRoot = project?.rootPath;
        if (!filePath)
            return reply.status(400).send({ error: 'path is required' });
        if (serverId === 'server-local') {
            try {
                const all = parseSshConfig();
                const localServer = all.find((s) => s.id === 'server-local');
                return await fsService.readLocalFile(filePath, projectRoot || localServer?.workspace);
            }
            catch (err) {
                return reply.status(400).send({ error: err.message });
            }
        }
        else {
            const all = parseSshConfig();
            const target = all.find((s) => s.id === serverId);
            if (!target)
                return reply.status(404).send({ error: 'Server not found' });
            try {
                return await fsService.readRemoteFile(target, filePath, projectRoot);
            }
            catch (err) {
                return reply.status(500).send({ error: err.message });
            }
        }
    };
    // Support both /api/fs/read and legacy /api/file
    fastify.get('/api/fs/read', handleReadFile);
    fastify.get('/api/file', handleReadFile);
    const handleSaveFile = async (request, reply) => {
        const { serverId = 'server-local', projectId, path: filePath, content } = request.body || {};
        const project = projectId ? projectService.getProject(projectId) : projectService.getActiveProject(serverId);
        const projectRoot = project?.rootPath;
        if (!filePath)
            return reply.status(400).send({ error: 'path is required' });
        if (serverId === 'server-local') {
            try {
                const all = parseSshConfig();
                const localServer = all.find((s) => s.id === 'server-local');
                const result = await fsService.writeLocalFile(filePath, content, projectRoot || localServer?.workspace);
                return { success: true, ...result };
            }
            catch (err) {
                return reply.status(400).send({ error: err.message });
            }
        }
        else {
            const all = parseSshConfig();
            const target = all.find((s) => s.id === serverId);
            if (!target)
                return reply.status(404).send({ error: 'Server not found' });
            try {
                const result = await fsService.writeRemoteFile(target, filePath, content, projectRoot);
                return { success: true, ...result };
            }
            catch (err) {
                return reply.status(500).send({ error: err.message });
            }
        }
    };
    // Support both /api/fs/save and legacy /api/file
    fastify.post('/api/fs/save', handleSaveFile);
    fastify.post('/api/file', handleSaveFile);
    fastify.post('/api/fs/action', async (request, reply) => {
        const { action, serverId = 'server-local', projectId, path: itemPath, type = 'file', oldPath, newPath } = request.body || {};
        const project = projectId ? projectService.getProject(projectId) : projectService.getActiveProject(serverId);
        const projectRoot = project?.rootPath;
        if (serverId === 'server-local') {
            try {
                const all = parseSshConfig();
                const localServer = all.find((s) => s.id === 'server-local');
                const ws = projectRoot || localServer?.workspace;
                if (action === 'create') {
                    if (!itemPath)
                        return reply.status(400).send({ error: 'path required' });
                    await fsService.createLocal(itemPath, type, ws);
                }
                else if (action === 'delete') {
                    if (!itemPath)
                        return reply.status(400).send({ error: 'path required' });
                    await fsService.deleteLocal(itemPath, ws);
                }
                else if (action === 'rename') {
                    if (!oldPath || !newPath)
                        return reply.status(400).send({ error: 'oldPath and newPath required' });
                    await fsService.renameLocal(oldPath, newPath, ws);
                }
                return { success: true };
            }
            catch (err) {
                return reply.status(400).send({ error: err.message });
            }
        }
        else {
            const all = parseSshConfig();
            const target = all.find((s) => s.id === serverId);
            if (!target)
                return reply.status(404).send({ error: 'Server not found' });
            try {
                if (action === 'create') {
                    if (!itemPath)
                        return reply.status(400).send({ error: 'path required' });
                    await fsService.createRemote(target, itemPath, type, projectRoot);
                }
                else if (action === 'delete') {
                    if (!itemPath)
                        return reply.status(400).send({ error: 'path required' });
                    await fsService.deleteRemote(target, itemPath, projectRoot);
                }
                else if (action === 'rename') {
                    if (!oldPath || !newPath)
                        return reply.status(400).send({ error: 'oldPath and newPath required' });
                    await fsService.renameRemote(target, oldPath, newPath, projectRoot);
                }
                else {
                    return reply.status(400).send({ error: `Unknown action: ${action}` });
                }
                return { success: true };
            }
            catch (err) {
                return reply.status(400).send({ error: err.message });
            }
        }
    });
    // --- FS DOWNLOAD ROUTE ---
    fastify.get('/api/fs/download', async (request, reply) => {
        const serverId = request.query.serverId || 'server-local';
        const projectId = request.query.projectId;
        const itemPath = request.query.path || '';
        const project = projectId ? projectService.getProject(projectId) : projectService.getActiveProject(serverId);
        const projectRoot = project?.rootPath;
        if (serverId === 'server-local') {
            try {
                const all = parseSshConfig();
                const localServer = all.find((s) => s.id === 'server-local');
                const ws = projectRoot || localServer?.workspace;
                const fullPath = fsService.resolveLocalPath(itemPath, ws);
                if (!fs.existsSync(fullPath)) {
                    return reply.status(404).send({ error: 'File or directory not found' });
                }
                const stat = fs.statSync(fullPath);
                if (stat.isFile()) {
                    const fileName = path.basename(fullPath);
                    reply.header('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
                    reply.header('Content-Type', 'application/octet-stream');
                    reply.header('Content-Length', stat.size);
                    return reply.send(fs.createReadStream(fullPath));
                }
                else if (stat.isDirectory()) {
                    const folderName = path.basename(fullPath) || 'workspace';
                    const zipRes = await tempZipService.createLocalZip(fullPath, folderName);
                    reply.header('Content-Disposition', `attachment; filename="${encodeURIComponent(zipRes.fileName)}"`);
                    reply.header('Content-Type', 'application/zip');
                    reply.header('Content-Length', zipRes.size);
                    reply.header('X-Zip-Archive-Name', zipRes.fileName);
                    return reply.send(fs.createReadStream(zipRes.zipPath));
                }
                else {
                    return reply.status(400).send({ error: 'Unsupported file type' });
                }
            }
            catch (err) {
                return reply.status(400).send({ error: err.message });
            }
        }
        else {
            const all = parseSshConfig();
            const target = all.find((s) => s.id === serverId);
            if (!target)
                return reply.status(404).send({ error: 'Server not found' });
            try {
                const remotePath = fsService.resolveRemotePath(target, itemPath, projectRoot);
                const sftp = await sshPool.getSftp(target);
                const stat = await new Promise((resolve, reject) => {
                    sftp.stat(remotePath, (err, st) => {
                        if (err)
                            reject(err);
                        else
                            resolve(st);
                    });
                });
                if (stat.isFile()) {
                    const fileName = path.posix.basename(remotePath);
                    reply.header('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
                    reply.header('Content-Type', 'application/octet-stream');
                    reply.header('Content-Length', stat.size);
                    const stream = sftp.createReadStream(remotePath);
                    return reply.send(stream);
                }
                else if (stat.isDirectory()) {
                    const folderName = path.posix.basename(remotePath) || 'workspace';
                    const zipRes = await tempZipService.createRemoteZip(target, remotePath, folderName);
                    reply.header('Content-Disposition', `attachment; filename="${encodeURIComponent(zipRes.fileName)}"`);
                    reply.header('Content-Type', 'application/zip');
                    reply.header('Content-Length', zipRes.size);
                    reply.header('X-Zip-Archive-Name', zipRes.fileName);
                    return reply.send(fs.createReadStream(zipRes.zipPath));
                }
                else {
                    return reply.status(400).send({ error: 'Unsupported remote item type' });
                }
            }
            catch (err) {
                return reply.status(500).send({ error: err.message });
            }
        }
    });
    // --- FS UPLOAD ROUTE ---
    fastify.post('/api/fs/upload', async (request, reply) => {
        const serverId = request.query.serverId || 'server-local';
        const projectId = request.query.projectId;
        const targetRelDir = request.query.targetDir || '';
        const project = projectId ? projectService.getProject(projectId) : projectService.getActiveProject(serverId);
        const projectRoot = project?.rootPath;
        let uploadedCount = 0;
        let totalBytes = 0;
        const isLocal = serverId === 'server-local';
        let localBaseDir = '';
        let remoteTargetServer = null;
        let remoteSftp = null;
        if (isLocal) {
            const all = parseSshConfig();
            const localServer = all.find((s) => s.id === 'server-local');
            const ws = projectRoot || localServer?.workspace;
            localBaseDir = fsService.resolveLocalPath(targetRelDir, ws);
            if (!fs.existsSync(localBaseDir)) {
                fs.mkdirSync(localBaseDir, { recursive: true });
            }
        }
        else {
            const all = parseSshConfig();
            const target = all.find((s) => s.id === serverId);
            if (!target)
                return reply.status(404).send({ error: 'Server not found' });
            remoteTargetServer = target;
            remoteSftp = await sshPool.getSftp(target);
            const remoteBaseDir = fsService.resolveRemotePath(target, targetRelDir, projectRoot);
            await fsService.sftpMkdirRecursive(remoteSftp, remoteBaseDir);
        }
        const parts = request.files();
        for await (const part of parts) {
            let rawRel = part.filename;
            try {
                rawRel = decodeURIComponent(part.filename);
            }
            catch (_) { }
            const relField = part.fields?.relativePath?.value || part.fields?.relPath?.value;
            if (typeof relField === 'string' && relField.trim()) {
                rawRel = relField;
            }
            const safeRel = rawRel.replace(/\\/g, '/').split('/').filter((seg) => seg && seg !== '..').join('/');
            if (!safeRel)
                continue;
            if (isLocal) {
                const destPath = path.resolve(localBaseDir, safeRel);
                if (!destPath.startsWith(localBaseDir)) {
                    continue;
                }
                const parentDir = path.dirname(destPath);
                if (!fs.existsSync(parentDir)) {
                    fs.mkdirSync(parentDir, { recursive: true });
                }
                await new Promise((resolve, reject) => {
                    const writeStream = fs.createWriteStream(destPath);
                    part.file.pipe(writeStream);
                    writeStream.on('finish', () => {
                        uploadedCount++;
                        try {
                            totalBytes += fs.statSync(destPath).size;
                        }
                        catch (_) { }
                        resolve();
                    });
                    writeStream.on('error', reject);
                });
            }
            else if (remoteTargetServer && remoteSftp) {
                const remoteBaseDir = fsService.resolveRemotePath(remoteTargetServer, targetRelDir, projectRoot);
                const destPath = path.posix.join(remoteBaseDir, safeRel);
                const parentDir = path.posix.dirname(destPath);
                await fsService.sftpMkdirRecursive(remoteSftp, parentDir);
                await new Promise((resolve, reject) => {
                    const writeStream = remoteSftp.createWriteStream(destPath);
                    part.file.pipe(writeStream);
                    writeStream.on('close', () => {
                        uploadedCount++;
                        resolve();
                    });
                    writeStream.on('error', reject);
                });
            }
        }
        return {
            success: true,
            count: uploadedCount,
            totalBytes,
        };
    });
    // --- TEMP ZIP ARCHIVES & CLEANUP ROUTES ---
    fastify.get('/api/fs/tmp-archives', async () => {
        return { archives: tempZipService.listArchives() };
    });
    fastify.delete('/api/fs/tmp-archives', async () => {
        const res = tempZipService.purgeAll();
        return { success: true, ...res };
    });
    fastify.delete('/api/fs/tmp-archives/:id', async (request, reply) => {
        const ok = tempZipService.deleteArchive(request.params.id);
        if (!ok)
            return reply.status(404).send({ error: 'Archive not found' });
        return { success: true };
    });
    // --- SESSIONS ---
    fastify.get('/api/sessions', async (request) => {
        return { sessions: sessionManager.list(request.query.serverId) };
    });
    fastify.delete('/api/sessions/:id', async (request) => {
        sessionManager.close(request.params.id);
        return { success: true };
    });
    // --- CLAUDE SESSIONS & CHAT ---
    fastify.get('/api/claude/sessions', async (request) => {
        const serverId = request.query.serverId || 'server-local';
        const projectId = request.query.projectId || '';
        const defaultCwd = request.query.defaultCwd || '';
        const sessions = claudeService.getSessionsForServer(serverId, defaultCwd, projectId);
        return { sessions };
    });
    fastify.post('/api/claude/sessions', async (request, reply) => {
        const { serverId, projectId, name, cwd, model, mode, initialPrompt, bypassPermissions } = request.body || {};
        if (!serverId) {
            return reply.status(400).send({ error: 'serverId is required' });
        }
        const session = claudeService.createSession(serverId, projectId || '', name || 'chat', cwd || '', model, mode, initialPrompt, Boolean(bypassPermissions));
        return { success: true, session };
    });
    fastify.patch('/api/claude/sessions/:id', async (request, reply) => {
        const session = claudeService.updateSession(request.params.id, request.body || {});
        if (!session)
            return reply.status(404).send({ error: 'Session not found' });
        return { success: true, session };
    });
    fastify.delete('/api/claude/sessions/:id', async (request, reply) => {
        const ok = claudeService.deleteSession(request.params.id);
        if (!ok)
            return reply.status(404).send({ error: 'Session not found' });
        return { success: true };
    });
    fastify.post('/api/claude/sessions/:id/messages', async (request, reply) => {
        const { id } = request.params;
        const { prompt } = request.body || {};
        if (!prompt || !prompt.trim()) {
            return reply.status(400).send({ error: 'prompt is required' });
        }
        const session = claudeService.getSession(id);
        if (!session)
            return reply.status(404).send({ error: 'Session not found' });
        const now = new Date();
        const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        // 1. Add user message
        const userMsg = {
            id: `msg-${Date.now()}-u`,
            sender: 'user',
            text: prompt.trim(),
            time: timeStr,
        };
        claudeService.addMessage(id, userMsg);
        // 2. Execute Claude CLI / agent asynchronously
        const assistantResult = await claudeService.runClaudePrompt(session, prompt.trim(), () => { });
        // 3. Add assistant message
        const asstMsg = {
            id: `msg-${Date.now()}-a`,
            sender: 'assistant',
            text: assistantResult.text,
            time: timeStr,
            tools: assistantResult.tools,
        };
        const updated = claudeService.addMessage(id, asstMsg, session.contextTokens);
        return {
            success: true,
            userMessage: userMsg,
            assistantMessage: asstMsg,
            session: updated,
        };
    });
    fastify.post('/api/claude/sessions/:id/messages/stream', async (request, reply) => {
        const { id } = request.params;
        const { prompt } = request.body || {};
        if (!prompt || !prompt.trim()) {
            return reply.status(400).send({ error: 'prompt is required' });
        }
        const session = claudeService.getSession(id);
        if (!session)
            return reply.status(404).send({ error: 'Session not found' });
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
            sender: 'user',
            text: prompt.trim(),
            time: timeStr,
        };
        claudeService.addMessage(id, userMsg);
        const task = claudeService.startBackgroundPrompt(session, prompt.trim());
        const sendEvent = (data) => {
            try {
                reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
            }
            catch (_) { }
        };
        // Send initial sync state
        sendEvent({
            type: 'sync',
            status: task.status,
            liveMessage: task.liveMessage,
            contextTokens: session.contextTokens,
        });
        if (task.status !== 'running') {
            reply.raw.write('data: [DONE]\n\n');
            return reply.raw.end();
        }
        const listener = (event) => {
            sendEvent(event);
            if (event.type === 'finish' || event.type === 'error' || (event.type === 'done' && task.status !== 'running')) {
                try {
                    reply.raw.write('data: [DONE]\n\n');
                    reply.raw.end();
                }
                catch (_) { }
            }
        };
        task.listeners.add(listener);
        request.raw.on('close', () => {
            task.listeners.delete(listener);
            // NOTE: Do not kill background execution, allows mobile browser to reconnect!
        });
    });
    fastify.get('/api/claude/sessions/:id/stream', async (request, reply) => {
        const { id } = request.params;
        const session = claudeService.getSession(id);
        if (!session)
            return reply.status(404).send({ error: 'Session not found' });
        reply.raw.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
        reply.raw.setHeader('Cache-Control', 'no-cache, no-transform');
        reply.raw.setHeader('Connection', 'keep-alive');
        reply.raw.setHeader('X-Accel-Buffering', 'no');
        reply.raw.flushHeaders?.();
        const sendEvent = (data) => {
            try {
                reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
            }
            catch (_) { }
        };
        const task = claudeService.getTask(id);
        if (!task || task.status !== 'running') {
            const lastMsg = session.messages[session.messages.length - 1];
            sendEvent({
                type: 'sync',
                status: task?.status || 'done',
                liveMessage: task?.liveMessage || lastMsg,
                contextTokens: session.contextTokens,
            });
            reply.raw.write('data: [DONE]\n\n');
            return reply.raw.end();
        }
        // Send initial snapshot of live background message
        sendEvent({
            type: 'sync',
            status: task.status,
            liveMessage: task.liveMessage,
            contextTokens: session.contextTokens,
        });
        const listener = (event) => {
            sendEvent(event);
            if (event.type === 'finish' || event.type === 'error' || (event.type === 'done' && task.status !== 'running')) {
                try {
                    reply.raw.write('data: [DONE]\n\n');
                    reply.raw.end();
                }
                catch (_) { }
            }
        };
        task.listeners.add(listener);
        request.raw.on('close', () => {
            task.listeners.delete(listener);
        });
    });
    fastify.get('/api/claude/sessions/:id/task', async (request, reply) => {
        const { id } = request.params;
        const task = claudeService.getTask(id);
        if (!task) {
            return { isRunning: false };
        }
        return {
            isRunning: task.status === 'running',
            status: task.status,
            startTime: task.startTime,
            liveMessage: task.liveMessage,
        };
    });
    fastify.post('/api/claude/sessions/:id/cancel', async (request) => {
        const cancelled = claudeService.cancelRun(request.params.id);
        return { success: true, cancelled };
    });
    fastify.post('/api/claude/sessions/:id/clear', async (request, reply) => {
        const session = claudeService.clearMessages(request.params.id);
        if (!session)
            return reply.status(404).send({ error: 'Session not found' });
        return { success: true, session };
    });
    fastify.get('/api/claude/limits', async () => {
        return {
            limits: claudeService.getLimits(),
        };
    });
    fastify.get('/api/claude/models', async (request) => {
        const serverId = request.query.serverId || 'server-local';
        const result = await claudeService.getAvailableModels(serverId, request.query.refresh === '1', request.query.cwd);
        return result;
    });
    // --- CLAUDE CODE PROJECT SESSIONS (Real CLI sessions from ~/.claude/projects/) ---
    fastify.get('/api/claude/project-sessions', async (request) => {
        const cwd = request.query.cwd || '';
        const serverId = request.query.serverId || 'server-local';
        const sessions = await claudeService.listProjectSessions(cwd, serverId);
        return { success: true, sessions };
    });
    fastify.get('/api/claude/project-sessions/:id', async (request, reply) => {
        const { id } = request.params;
        const cwd = request.query.cwd || '';
        const serverId = request.query.serverId || 'server-local';
        const session = await claudeService.getProjectSessionDetail(id, cwd, serverId);
        if (!session)
            return reply.status(404).send({ error: 'Project session not found' });
        return { success: true, session };
    });
    fastify.post('/api/claude/project-sessions/:id/resume', async (request, reply) => {
        const { id } = request.params;
        const { cwd, targetSessionId, serverId, projectId } = request.body || {};
        const updated = await claudeService.resumeProjectSession(id, cwd || '', targetSessionId, serverId || 'server-local', projectId);
        if (!updated)
            return reply.status(404).send({ error: 'Failed to resume project session' });
        return { success: true, session: updated };
    });
    fastify.patch('/api/claude/project-sessions/:id', async (request, reply) => {
        const { id } = request.params;
        const { name, cwd, serverId } = request.body || {};
        if (!name || !name.trim()) {
            return reply.status(400).send({ error: 'Session name is required' });
        }
        const ok = await claudeService.renameProjectSession(id, name.trim(), cwd || '', serverId || 'server-local');
        if (!ok)
            return reply.status(404).send({ error: 'Project session not found or rename failed' });
        return { success: true, name: name.trim() };
    });
    fastify.delete('/api/claude/project-sessions/:id', async (request, reply) => {
        const { id } = request.params;
        const cwd = request.query.cwd || '';
        const serverId = request.query.serverId || 'server-local';
        const ok = await claudeService.deleteProjectSession(id, cwd, serverId);
        if (!ok)
            return reply.status(404).send({ error: 'Project session not found or deletion failed' });
        return { success: true };
    });
    // --- GIT ---
    fastify.get('/api/git/status', async (request, reply) => {
        const serverId = request.query.serverId || 'server-local';
        const target = getGitProject(serverId, request.query.projectId);
        if ('error' in target)
            return reply.status(404).send({ error: target.error });
        const { project, service } = target;
        try {
            return await service.getStatus(project.rootPath);
        }
        catch (err) {
            return reply.status(400).send({ error: err.message });
        }
    });
    fastify.get('/api/git/diff', async (request, reply) => {
        const serverId = request.query.serverId || 'server-local';
        const target = getGitProject(serverId, request.query.projectId);
        if ('error' in target)
            return reply.status(404).send({ error: target.error });
        const { project, service } = target;
        const file = request.query.file || '';
        if (!file)
            return reply.status(400).send({ error: 'file is required' });
        try {
            return await service.getDiff(project.rootPath, file);
        }
        catch (err) {
            return reply.status(400).send({ error: err.message });
        }
    });
    function getGitProject(serverId, projectId) {
        const server = parseSshConfig().find(s => s.id === serverId);
        if (!server)
            return { error: 'Server not found' };
        const project = projectId ? projectService.getProject(projectId) : projectService.getActiveProject(serverId);
        if (!project || project.serverId !== serverId)
            return { error: 'Project not found' };
        return { project, service: createGitService(server) };
    }
    fastify.get('/api/git/branches', async (request, reply) => {
        const serverId = request.query.serverId || 'server-local';
        const target = getGitProject(serverId, request.query.projectId);
        if ('error' in target)
            return reply.status(404).send({ error: target.error });
        try {
            return { branches: await target.service.getBranches(target.project.rootPath) };
        }
        catch (err) {
            return reply.status(400).send({ error: err.message });
        }
    });
    fastify.post('/api/git/checkout', async (request, reply) => {
        const serverId = request.body?.serverId || 'server-local';
        const target = getGitProject(serverId, request.body?.projectId);
        if ('error' in target)
            return reply.status(404).send({ error: target.error });
        const branch = request.body?.branch || '';
        if (!branch.trim())
            return reply.status(400).send({ error: 'branch is required' });
        try {
            await target.service.checkout(target.project.rootPath, branch);
            return { success: true, status: await target.service.getStatus(target.project.rootPath), branches: await target.service.getBranches(target.project.rootPath) };
        }
        catch (err) {
            return reply.status(400).send({ error: err.message });
        }
    });
    fastify.post('/api/git/pull', async (request, reply) => {
        const serverId = request.body?.serverId || 'server-local';
        const target = getGitProject(serverId, request.body?.projectId);
        if ('error' in target)
            return reply.status(404).send({ error: target.error });
        try {
            const output = await target.service.pull(target.project.rootPath);
            return { success: true, output, status: await target.service.getStatus(target.project.rootPath), branches: await target.service.getBranches(target.project.rootPath) };
        }
        catch (err) {
            return reply.status(400).send({ error: err.message });
        }
    });
    fastify.post('/api/git/push', async (request, reply) => {
        const serverId = request.body?.serverId || 'server-local';
        const target = getGitProject(serverId, request.body?.projectId);
        if ('error' in target)
            return reply.status(404).send({ error: target.error });
        try {
            const output = await target.service.push(target.project.rootPath);
            return { success: true, output, status: await target.service.getStatus(target.project.rootPath), branches: await target.service.getBranches(target.project.rootPath) };
        }
        catch (err) {
            return reply.status(400).send({ error: err.message });
        }
    });
    fastify.post('/api/git/stage', async (request, reply) => {
        const serverId = request.body?.serverId || 'server-local';
        const target = getGitProject(serverId, request.body?.projectId);
        if ('error' in target)
            return reply.status(404).send({ error: target.error });
        const { project, service } = target;
        const file = request.body?.file || '';
        if (!file)
            return reply.status(400).send({ error: 'file is required' });
        try {
            await service.stage(project.rootPath, file);
            return { success: true, status: await service.getStatus(project.rootPath) };
        }
        catch (err) {
            return reply.status(400).send({ error: err.message });
        }
    });
    fastify.post('/api/git/unstage', async (request, reply) => {
        const serverId = request.body?.serverId || 'server-local';
        const target = getGitProject(serverId, request.body?.projectId);
        if ('error' in target)
            return reply.status(404).send({ error: target.error });
        const { project, service } = target;
        const file = request.body?.file || '';
        if (!file)
            return reply.status(400).send({ error: 'file is required' });
        try {
            await service.unstage(project.rootPath, file);
            return { success: true, status: await service.getStatus(project.rootPath) };
        }
        catch (err) {
            return reply.status(400).send({ error: err.message });
        }
    });
    fastify.post('/api/git/commit', async (request, reply) => {
        const serverId = request.body?.serverId || 'server-local';
        const target = getGitProject(serverId, request.body?.projectId);
        if ('error' in target)
            return reply.status(404).send({ error: target.error });
        const { project, service } = target;
        const message = request.body?.message || '';
        if (!message.trim())
            return reply.status(400).send({ error: 'Commit message is required' });
        try {
            const output = await service.commit(project.rootPath, message);
            return { success: true, output, status: await service.getStatus(project.rootPath) };
        }
        catch (err) {
            return reply.status(400).send({ error: err.message });
        }
    });
    fastify.post('/api/claude/limits', async (request) => {
        const updated = claudeService.updateLimits(request.body || {});
        return { success: true, limits: updated };
    });
};
