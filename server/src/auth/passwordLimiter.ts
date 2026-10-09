import type { FastifyRequest } from 'fastify';
import crypto from 'crypto';
import { authConfig } from './config.js';
import { passwordStore } from './passwordStore.js';
import type { AttemptRecord } from './types.js';

export type PasswordCheckResult =
  | { ok: true }
  | { ok: false; status: 401; error: 'wrong_password'; attemptsLeft: number }
  | { ok: false; status: 429; error: 'locked'; retryAfterSeconds: number };

class PasswordLimiter {
  private attempts = new Map<string, AttemptRecord>();

  check(req: FastifyRequest, password: string): PasswordCheckResult {
    const ip = this.getClientIp(req);
    const now = Date.now();
    this.cleanupExpired(now);
    const state = this.attempts.get(ip) || { failedCount: 0, lockedUntil: 0 };

    if (state.lockedUntil > now) {
      return {
        ok: false,
        status: 429,
        error: 'locked',
        retryAfterSeconds: Math.ceil((state.lockedUntil - now) / 1000),
      };
    }

    if (this.matches(password)) {
      this.attempts.delete(ip);
      return { ok: true };
    }

    state.failedCount += 1;
    if (state.failedCount >= authConfig.maxAttempts) {
      state.failedCount = 0;
      state.lockedUntil = now + authConfig.lockMinutes * 60 * 1000;
      this.attempts.set(ip, state);
      return {
        ok: false,
        status: 429,
        error: 'locked',
        retryAfterSeconds: authConfig.lockMinutes * 60,
      };
    }

    this.attempts.set(ip, state);
    return {
      ok: false,
      status: 401,
      error: 'wrong_password',
      attemptsLeft: authConfig.maxAttempts - state.failedCount,
    };
  }

  private matches(password: string): boolean {
    return passwordStore.verify(password);
  }

  private getClientIp(req: FastifyRequest): string {
    // Cloudflare Tunnel sets cf-connecting-ip directly from client socket
    const cfIp = req.headers['cf-connecting-ip'];
    if (typeof cfIp === 'string' && cfIp.trim()) {
      return cfIp.trim();
    }
    const xRealIp = req.headers['x-real-ip'];
    if (typeof xRealIp === 'string' && xRealIp.trim()) {
      return xRealIp.trim();
    }
    if ((process.env.TRUST_PROXY || '').toLowerCase() === 'true') {
      const xff = req.headers['x-forwarded-for'];
      const first = Array.isArray(xff) ? xff[0] : xff;
      if (first) return first.split(',')[0].trim();
    }
    return req.ip || req.socket.remoteAddress || 'unknown';
  }

  private cleanupExpired(now: number) {
    if (this.attempts.size > 1000) {
      for (const [ip, state] of this.attempts.entries()) {
        if (state.lockedUntil > 0 && state.lockedUntil < now) {
          this.attempts.delete(ip);
        }
      }
    }
  }
}

export const passwordLimiter = new PasswordLimiter();
