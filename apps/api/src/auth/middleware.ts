import type { FastifyReply, FastifyRequest } from 'fastify';
import { authConfig, stripBasePath, withBasePath } from './config.js';
import { sessionStore } from './sessionStore.js';

export function isAuthenticated(req: FastifyRequest): boolean {
  return sessionStore.isAuthenticated(req);
}

export function requireAuthForWs(req: FastifyRequest): boolean {
  if (authConfig.mode === 'none') return true;
  const user = sessionStore.getUser(req);
  if (!user) return false;
  if (user.mustChangePassword) return false;
  return true;
}

function isPublicPath(pathname: string): boolean {
  const p = stripBasePath(pathname);
  if (p.startsWith('/api/')) {
    return (
      p === '/api/auth/me' ||
      p === '/api/auth/password' ||
      p === '/api/auth/logout' ||
      p === '/api/auth/change-password'
    );
  }
  return (
    p === '/login' ||
    p === '/auth/google' ||
    p === '/auth/google/callback' ||
    p.startsWith('/assets/') ||
    p === '/favicon.ico' ||
    p === '/manifest.webmanifest' ||
    p.endsWith('.png') ||
    p.endsWith('.svg') ||
    p.endsWith('.ico')
  );
}

function wantsHtml(req: FastifyRequest): boolean {
  const accept = String(req.headers.accept || '');
  return accept.includes('text/html') || accept.includes('*/*');
}

export async function authGuard(req: FastifyRequest, reply: FastifyReply) {
  if (authConfig.mode === 'none') return;
  const pathname = new URL(req.url, 'http://local').pathname;
  if (isPublicPath(pathname)) return;

  const user = sessionStore.getUser(req);
  if (!user) {
    if (wantsHtml(req) && !pathname.includes('/api/') && !pathname.includes('/ws/')) {
      return reply.redirect(withBasePath('/login'));
    }
    return reply.status(401).send({ error: 'unauthorized', mode: authConfig.mode });
  }

  // If user is required to change password, deny access to regular APIs & sockets
  if (user.mustChangePassword) {
    const clean = stripBasePath(pathname);
    if (clean === '/api/auth/change-password' || clean === '/api/auth/me' || clean === '/api/auth/logout') {
      return;
    }
    if (wantsHtml(req) && !pathname.includes('/api/') && !pathname.includes('/ws/')) {
      return; // Allow frontend shell to mount and display change-password form
    }
    return reply.status(403).send({ error: 'password_change_required' });
  }
}
