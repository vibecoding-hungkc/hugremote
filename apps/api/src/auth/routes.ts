import type { FastifyInstance } from 'fastify';
import { BASE_PATH } from '../config.js';
import { authConfig } from './config.js';
import { redirectToGoogle, handleGoogleCallback } from './googleOAuth.js';
import { passwordLimiter } from './passwordLimiter.js';
import { passwordStore } from './passwordStore.js';
import { sessionStore } from './sessionStore.js';
import { twoFactorStore } from './twoFactorStore.js';

function authStatus(req: any) {
  const user = sessionStore.getUser(req);
  const twoFactorEnabled = twoFactorStore.isEnabled();
  const requiresTwoFactor = twoFactorEnabled
    ? authConfig.mode === 'none'
      ? !user || !user.twoFactorVerified
      : Boolean(user && !user.mustChangePassword && !user.twoFactorVerified)
    : false;
  const fullyAuthenticated = Boolean(
    user && !user.mustChangePassword && (!twoFactorEnabled || user.twoFactorVerified)
  );

  return {
    mode: authConfig.mode,
    authenticated: fullyAuthenticated,
    user,
    mustChangePassword: Boolean(user?.mustChangePassword),
    twoFactorEnabled,
    requiresTwoFactor,
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
      const twoFactorEnabled = twoFactorStore.isEnabled();
      sessionStore.create(reply, {
        provider: 'password',
        mustChangePassword: mustChange,
        twoFactorVerified: !twoFactorEnabled,
      });
      return {
        success: true,
        mustChangePassword: mustChange,
        requiresTwoFactor: twoFactorEnabled && !mustChange,
      };
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

      if (!user.mustChangePassword) {
        if (!currentPassword || !passwordStore.verify(currentPassword)) {
          return reply.status(400).send({ success: false, error: 'invalid_current_password' });
        }
      }

      try {
        passwordStore.changePassword(newPassword);
        user.mustChangePassword = false;
        return {
          success: true,
          requiresTwoFactor: twoFactorStore.isEnabled() && !user.twoFactorVerified,
        };
      } catch (err: any) {
        return reply.status(400).send({ success: false, error: err.message });
      }
    }
  );

  // --- TWO-FACTOR AUTHENTICATION (2FA TOTP) ROUTES ---
  fastify.get('/api/auth/2fa/status', async (req, reply) => {
    if (!sessionStore.isAuthenticated(req)) {
      return reply.status(401).send({ error: 'unauthorized' });
    }
    return twoFactorStore.getStatus();
  });

  fastify.post('/api/auth/2fa/setup', async (req, reply) => {
    if (!sessionStore.isAuthenticated(req)) {
      return reply.status(401).send({ error: 'unauthorized' });
    }
    const user = sessionStore.getUser(req);
    const label = user?.email || 'HugRemote Web';
    const setup = twoFactorStore.beginSetup(label);
    return {
      success: true,
      ...setup,
    };
  });

  fastify.post<{ Body: { code?: string } }>('/api/auth/2fa/enable', async (req, reply) => {
    if (!sessionStore.isAuthenticated(req)) {
      return reply.status(401).send({ error: 'unauthorized' });
    }
    const rawCode = req.body?.code || '';
    const result = twoFactorStore.confirmEnable(rawCode);
    if (!result.ok) {
      return reply.status(400).send({
        success: false,
        error: 'invalid_2fa_code',
        message: 'Mã xác thực 6 số không chính xác hoặc đã hết hạn',
      });
    }

    const currentUser = sessionStore.getUser(req) || { provider: authConfig.mode };
    currentUser.twoFactorVerified = true;
    sessionStore.create(reply, currentUser);

    return {
      success: true,
      enabled: true,
      remainingRecoveryCodes: result.remainingRecoveryCodes,
    };
  });

  fastify.post<{ Body: { code?: string } }>('/api/auth/2fa/verify', async (req, reply) => {
    if (!twoFactorStore.isEnabled()) {
      return { success: true };
    }

    let user = sessionStore.getUser(req);
    if (authConfig.mode !== 'none' && !user) {
      return reply.status(401).send({
        success: false,
        error: 'unauthorized',
      });
    }

    const rawCode = typeof req.body?.code === 'string' ? req.body.code.trim() : '';
    if (!rawCode || rawCode.length > 64) {
      return reply.status(400).send({
        success: false,
        error: 'invalid_2fa_code',
      });
    }

    const check = twoFactorStore.verifyCodeOrRecovery(rawCode);
    if (!check.ok) {
      return reply.status(401).send({
        success: false,
        error: 'invalid_2fa_code',
        message: 'Mã xác thực 2FA hoặc mã khôi phục không hợp lệ',
      });
    }

    if (user) {
      user.twoFactorVerified = true;
    } else {
      user = { provider: 'none', twoFactorVerified: true };
      sessionStore.create(reply, user);
    }

    return {
      success: true,
      usedRecoveryCode: check.usedRecoveryCode,
      remainingRecoveryCodes: twoFactorStore.getStatus().remainingRecoveryCodes,
    };
  });

  fastify.post<{ Body: { code?: string } }>('/api/auth/2fa/disable', async (req, reply) => {
    if (!sessionStore.isAuthenticated(req)) {
      return reply.status(401).send({ error: 'unauthorized' });
    }
    const rawCode = typeof req.body?.code === 'string' ? req.body.code.trim() : '';
    const ok = twoFactorStore.disable(rawCode);
    if (!ok) {
      return reply.status(400).send({
        success: false,
        error: 'invalid_2fa_code',
        message: 'Mã xác thực 2FA hoặc mã khôi phục không hợp lệ',
      });
    }
    return {
      success: true,
      enabled: false,
    };
  });

  fastify.post<{ Body: { code?: string } }>('/api/auth/2fa/recovery-codes', async (req, reply) => {
    if (!sessionStore.isAuthenticated(req)) {
      return reply.status(401).send({ error: 'unauthorized' });
    }
    const rawCode = typeof req.body?.code === 'string' ? req.body.code.trim() : '';
    const codes = twoFactorStore.regenerateRecoveryCodes(rawCode);
    if (!codes) {
      return reply.status(400).send({
        success: false,
        error: 'invalid_2fa_code',
        message: 'Mã xác thực 2FA không hợp lệ',
      });
    }
    return {
      success: true,
      recoveryCodes: codes,
      remainingRecoveryCodes: codes.length,
    };
  });

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
