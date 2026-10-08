import { WebSocket } from 'ws';
import { LocalPtyInstance, createLocalPty } from './localPty.js';
import { RemotePtyInstance, sshPool } from './sshPool.js';
import { ServerConfig, LOCAL_WORKSPACE } from '../config.js';

export interface UnifiedSession {
  id: string;
  name: string;
  serverId: string;
  cwd: string;
  createdAt: number;
  lastActive: number;
  clients: Set<WebSocket>;
  backend: LocalPtyInstance | RemotePtyInstance;
}

class SessionManager {
  private sessions = new Map<string, UnifiedSession>();

  async getOrCreateSession(
    serverId: string,
    sessionId: string,
    name: string,
    serverConfig: ServerConfig,
    cols = 80,
    rows = 24,
    targetCwd?: string
  ): Promise<UnifiedSession> {
    const existing = this.sessions.get(sessionId);
    if (existing) {
      existing.lastActive = Date.now();
      return existing;
    }

    let backend: LocalPtyInstance | RemotePtyInstance;

    const effectiveCwd = targetCwd || serverConfig.workspace || LOCAL_WORKSPACE;

    if (serverConfig.type === 'local') {
      backend = createLocalPty(sessionId, name, effectiveCwd, cols, rows);
    } else {
      backend = await sshPool.createShell(
        { id: sessionId, name, serverId: serverConfig.id, cols, rows, cwd: targetCwd },
        serverConfig
      );
    }

    const session: UnifiedSession = {
      id: sessionId,
      name,
      serverId,
      cwd: effectiveCwd,
      createdAt: Date.now(),
      lastActive: Date.now(),
      clients: new Set(),
      backend,
    };

    backend.onData((data: string) => {
      session.lastActive = Date.now();
      for (const client of session.clients) {
        if (client.readyState === WebSocket.OPEN) {
          try {
            client.send(data);
          } catch (_) {}
        }
      }
    });

    backend.onExit(() => {
      for (const client of session.clients) {
        if (client.readyState === WebSocket.OPEN) {
          try {
            client.send('\r\n\x1b[33m[Process exited]\x1b[0m\r\n');
            client.close();
          } catch (_) {}
        }
      }
      this.sessions.delete(sessionId);
    });

    this.sessions.set(sessionId, session);
    return session;
  }

  attach(sessionId: string, ws: WebSocket, session: UnifiedSession) {
    // Clean up any stale / closed sockets from the set
    for (const client of Array.from(session.clients)) {
      if (client.readyState !== WebSocket.OPEN && client.readyState !== WebSocket.CONNECTING) {
        session.clients.delete(client);
      }
    }

    session.clients.add(ws);
    session.lastActive = Date.now();

    // Replay buffer on attach
    if (session.backend.buffer) {
      try {
        ws.send(session.backend.buffer);
      } catch (_) {}
    }
  }

  detach(sessionId: string, ws: WebSocket) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.clients.delete(ws);
      // Backend remains alive!
    }
  }

  write(sessionId: string, data: string) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActive = Date.now();
      session.backend.write(data);
    }
  }

  resize(sessionId: string, cols: number, rows: number) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.backend.resize(cols, rows);
    }
  }

  close(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.backend.kill();
      this.sessions.delete(sessionId);
    }
  }

  list(serverId?: string) {
    const list: Array<{
      id: string;
      name: string;
      serverId: string;
      activeClients: number;
      lastActive: number;
    }> = [];
    for (const s of this.sessions.values()) {
      if (!serverId || s.serverId === serverId) {
        list.push({
          id: s.id,
          name: s.name,
          serverId: s.serverId,
          activeClients: s.clients.size,
          lastActive: s.lastActive,
        });
      }
    }
    return list;
  }
}

export const sessionManager = new SessionManager();
