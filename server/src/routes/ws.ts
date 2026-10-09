import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { WebSocket } from 'ws';
import { parseSshConfig } from '../config.js';
import { requireAuthForWs } from '../auth.js';
import { sessionManager } from '../services/sessionManager.js';

function isValidWsOrigin(req: any): boolean {
  const origin = req.headers.origin;
  if (!origin) return true; // Direct non-browser clients (CLI tools / scripts)

  try {
    const originUrl = new URL(origin);
    const hostHeader = (req.headers.host || '').toString();
    const [hostName] = hostHeader.split(':');

    // Allow same host
    if (hostName && originUrl.hostname.toLowerCase() === hostName.toLowerCase()) {
      return true;
    }

    // Allow configured APP_URL
    if (process.env.APP_URL) {
      const appUrl = new URL(process.env.APP_URL);
      if (originUrl.origin.toLowerCase() === appUrl.origin.toLowerCase()) {
        return true;
      }
    }

    // Allow local development loopback
    if (['localhost', '127.0.0.1', '::1'].includes(originUrl.hostname.toLowerCase())) {
      return true;
    }
  } catch (_) {
    return false;
  }

  return false;
}

export const wsRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.get('/ws/terminal', { websocket: true }, async (socket: WebSocket, req) => {
    if (!isValidWsOrigin(req)) {
      socket.close(1008, 'Forbidden: Invalid Origin');
      return;
    }

    if (!requireAuthForWs(req)) {
      socket.close(1008, 'Unauthorized');
      return;
    }

    const query = (req.query || {}) as Record<string, string>;
    const serverId = query.serverId || 'server-local';
    const sessionId = query.sessionId || `term-${Date.now()}`;
    const sessionName = query.name || 'shell';
    const cols = parseInt(query.cols || '80', 10);
    const rows = parseInt(query.rows || '24', 10);
    const cwd = query.cwd;

    const servers = parseSshConfig();
    const serverConfig = servers.find((s) => s.id === serverId) || servers[0];

    try {
      const session = await sessionManager.getOrCreateSession(
        serverId,
        sessionId,
        sessionName,
        serverConfig,
        cols,
        rows,
        cwd
      );

      sessionManager.attach(sessionId, socket, session);

      // Heartbeat Keep-Alive (Ping every 25s to keep mobile carrier / Cloudflare tunnel alive)
      const pingInterval = setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) {
          try {
            socket.ping();
          } catch (_) {}
        } else {
          clearInterval(pingInterval);
        }
      }, 25000);

      socket.on('message', (message: Buffer | string) => {
        const raw = message.toString();

        // Check if message is control JSON (e.g. resize or ping)
        if (raw.startsWith('{') && raw.endsWith('}')) {
          try {
            const parsed = JSON.parse(raw);
            if (parsed.type === 'resize' && parsed.cols && parsed.rows) {
              sessionManager.resize(sessionId, parsed.cols, parsed.rows);
              return;
            }
            if (parsed.type === 'ping') {
              socket.send(JSON.stringify({ type: 'pong' }));
              return;
            }
          } catch (_) {
            // Not valid JSON, treat as raw keystroke data
          }
        }

        sessionManager.write(sessionId, raw);
      });

      socket.on('close', () => {
        clearInterval(pingInterval);
        sessionManager.detach(sessionId, socket);
      });

      socket.on('error', (err: any) => {
        clearInterval(pingInterval);
        console.warn(`WebSocket error on session ${sessionId}:`, err);
        sessionManager.detach(sessionId, socket);
      });
    } catch (err: any) {
      console.error('Failed to attach terminal session:', err);
      try {
        socket.send(`\r\n\x1b[31m[Connection Error: ${err.message}]\x1b[0m\r\n`);
        socket.close();
      } catch (_) {}
    }
  });
};
