import type { FastifyReply, FastifyRequest } from 'fastify';
import { authConfig, stripBasePath, withBasePath } from './config.js';
import { sessionStore } from './sessionStore.js';

export function isAuthenticated(req: FastifyRequest): boolean {
  return sessionStore.isAuthenticated(req);
}

export function requireAuthForWs(req: FastifyRequest): boolean {
  return authConfig.mode === 'none' || isAuthenticated(req);
}

function isPublicPath(pathname: string): boolean {
  const p = stripBasePath(pathname);
  if (p.startsWith('/api/')) {
    return (
      p === '/api/auth/me' ||
      p === '/api/auth/password' ||
      p === '/api/auth/logout'
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
  if (isAuthenticated(req)) return;
  if (wantsHtml(req) && !pathname.includes('/api/') && !pathname.includes('/ws/')) {
    return reply.redirect(withBasePath('/login'));
  }
  return reply.status(401).send({ error: 'unauthorized', mode: authConfig.mode });
}
