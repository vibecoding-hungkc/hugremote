import type { FastifyInstance } from 'fastify';
import { BASE_PATH } from '../config.js';
import { authConfig } from './config.js';
import { redirectToGoogle, handleGoogleCallback } from './googleOAuth.js';
import { passwordLimiter } from './passwordLimiter.js';
import { passwordStore } from './passwordStore.js';
import { sessionStore } from './sessionStore.js';

function authStatus(req: any) {
  const user = sessionStore.getUser(req);
  return {
    mode: authConfig.mode,
    authenticated: authConfig.mode === 'none' || Boolean(user),
    user,
    mustChangePassword: Boolean(user?.mustChangePassword),
    isDefaultPassword: passwordStore.isDefault(),
    appUrl: authConfig.appUrl,
    basePath: BASE_PATH,
  };
}

export async function authRoutes(fastify: FastifyInstance) {
  fastify.get('/api/auth/me', async (req) => authStatus(req));

  fastify.post<{ Body: { password?: string } }>('/api/auth/password', async (req, reply) => {
    if (authConfig.mode !== 'password') {
      return reply.status(400).send({ success: false, error: 'password_auth_disabled' });
    }

    const rawPassword = req.body?.password;
    if (typeof rawPassword !== 'string' || rawPassword.length === 0 || rawPassword.length > 256) {
      return reply.status(400).send({ success: false, error: 'invalid_password' });
    }

    const result = passwordLimiter.check(req, rawPassword);
    if (result.ok) {
      const mustChange = passwordStore.isDefault();
      sessionStore.create(reply, {
        provider: 'password',
        mustChangePassword: mustChange,
      });
      return { success: true, mustChangePassword: mustChange };
    }
    if (result.error === 'locked') {
      return reply.status(result.status).send({
        success: false,
        error: result.error,
        retryAfterSeconds: result.retryAfterSeconds,
      });
    }
    return reply.status(result.status).send({
      success: false,
      error: result.error,
      attemptsLeft: result.attemptsLeft,
    });
  });

  fastify.post<{ Body: { newPassword?: string; currentPassword?: string } }>(
    '/api/auth/change-password',
    async (req, reply) => {
      if (authConfig.mode !== 'password') {
        return reply.status(400).send({ success: false, error: 'password_auth_disabled' });
      }

      const user = sessionStore.getUser(req);
      if (!user) {
        return reply.status(401).send({ success: false, error: 'unauthorized' });
      }

      const { newPassword, currentPassword } = req.body || {};

      if (typeof newPassword !== 'string' || newPassword.length < 6 || newPassword.length > 256) {
        return reply.status(400).send({ success: false, error: 'password_too_short' });
      }

      if (newPassword === '123456') {
        return reply.status(400).send({ success: false, error: 'cannot_use_default_password' });
      }

      // If user had already changed password before, verify their current password first
      if (!user.mustChangePassword) {
        if (!currentPassword || !passwordStore.verify(currentPassword)) {
          return reply.status(400).send({ success: false, error: 'invalid_current_password' });
        }
      }

      try {
        passwordStore.changePassword(newPassword);
        user.mustChangePassword = false;
        return { success: true };
      } catch (err: any) {
        return reply.status(400).send({ success: false, error: err.message });
      }
    }
  );

  fastify.post('/api/auth/logout', async (req, reply) => {
    sessionStore.destroy(req, reply);
    return { success: true };
  });

  fastify.get('/auth/google', async (_req, reply) => {
    if (authConfig.mode !== 'google') return reply.status(400).send('Google auth is disabled');
    return redirectToGoogle(reply);
  });

  fastify.get<{ Querystring: { code?: string; state?: string; error?: string } }>('/auth/google/callback', async (req, reply) => {
    if (authConfig.mode !== 'google') return reply.status(400).send('Google auth is disabled');
    return handleGoogleCallback(req, reply);
  });
}
