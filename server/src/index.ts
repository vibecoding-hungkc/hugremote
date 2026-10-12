import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyWs from '@fastify/websocket';
import fastifyStatic from '@fastify/static';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { PORT, HOST, BASE_PATH } from './config.js';
import { apiRoutes } from './routes/api.js';
import { wsRoutes } from './routes/ws.js';
import { authGuard, authRoutes, validateAuthConfig } from './auth.js';
import { startTelegramBot, stopTelegramBot } from './telegram/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fastify = Fastify({
  logger: {
    level: 'info',
  },
});

async function main() {
  validateAuthConfig();

  await fastify.register(cors, {
    origin: (origin, cb) => {
      // Allow requests with no origin (mobile apps, curl, same-origin)
      if (!origin) return cb(null, true);
      try {
        const u = new URL(origin);
        if (['localhost', '127.0.0.1', '::1'].includes(u.hostname.toLowerCase())) {
          return cb(null, true);
        }
        if (process.env.APP_URL) {
          const appUrl = new URL(process.env.APP_URL);
          if (u.origin.toLowerCase() === appUrl.origin.toLowerCase()) {
            return cb(null, true);
          }
        }
      } catch (_) {}
      return cb(null, false);
    },
    credentials: true,
  });

  // Global Security Headers
  fastify.addHook('onSend', async (_req, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'SAMEORIGIN');
    reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  });

  await fastify.register(fastifyWs);

  await fastify.register(authRoutes);
  fastify.addHook('preHandler', authGuard);

  // Core API and WebSocket routes
  await fastify.register(apiRoutes);
  await fastify.register(wsRoutes);

  // If BASE_PATH is defined in environment, register subpath routes & redirection
  if (BASE_PATH) {
    fastify.get(BASE_PATH, async (req, reply) => {
      return reply.redirect(`${BASE_PATH}/`);
    });

    await fastify.register(authRoutes, { prefix: BASE_PATH });
    await fastify.register(apiRoutes, { prefix: BASE_PATH });
    await fastify.register(wsRoutes, { prefix: BASE_PATH });
  }

  // Serve Frontend Static Files
  const publicDir = path.resolve(__dirname, '../public');
  if (fs.existsSync(publicDir)) {
    function getIndexHtml(): string {
      const indexPath = path.join(publicDir, 'index.html');
      if (!fs.existsSync(indexPath)) return 'Frontend not built yet';
      const raw = fs.readFileSync(indexPath, 'utf8');
      return raw.replace(
        '</head>',
        `<script>window.__BASE_PATH__ = ${JSON.stringify(BASE_PATH)};</script></head>`
      );
    }

    // Root HTML entry
    fastify.get('/', async (req, reply) => {
      reply.header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      reply.header('Pragma', 'no-cache');
      reply.header('Expires', '0');
      return reply.type('text/html').send(getIndexHtml());
    });

    await fastify.register(fastifyStatic, {
      root: publicDir,
      prefix: '/',
      index: false,
    });

    if (BASE_PATH) {
      // Subpath HTML entry
      fastify.get(`${BASE_PATH}/`, async (req, reply) => {
        reply.header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        reply.header('Pragma', 'no-cache');
        reply.header('Expires', '0');
        return reply.type('text/html').send(getIndexHtml());
      });

      await fastify.register(fastifyStatic, {
        root: publicDir,
        prefix: `${BASE_PATH}/`,
        index: false,
        decorateReply: false,
      });
    }

    fastify.setNotFoundHandler((req, reply) => {
      const u = req.url;
      const isApiOrWs =
        u.startsWith('/api') ||
        u.startsWith('/ws') ||
        (BASE_PATH && (u.startsWith(`${BASE_PATH}/api`) || u.startsWith(`${BASE_PATH}/ws`)));

      if (isApiOrWs) {
        reply.status(404).send({ error: 'Endpoint not found' });
      } else {
        reply.type('text/html').send(getIndexHtml());
      }
    });
  }

  fastify.addHook('onClose', async () => {
    await stopTelegramBot();
  });

  try {
    await fastify.listen({ port: PORT, host: HOST });
    const baseMsg = BASE_PATH ? ` (Base path prefix: ${BASE_PATH})` : ' (No prefix)';
    console.log(`🚀 HugRemote Server running at http://${HOST}:${PORT}${baseMsg}`);

    // Kích hoạt Telegram Bot nếu có cấu hình TELEGRAM_BOT_TOKEN
    await startTelegramBot();
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

main();
