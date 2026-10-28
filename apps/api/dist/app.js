import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyWs from '@fastify/websocket';
import fastifyStatic from '@fastify/static';
import multipart from '@fastify/multipart';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { BASE_PATH } from './config/index.js';
import { apiRoutes } from './routes/api.js';
import { wsRoutes } from './routes/ws.js';
import { authGuard, authRoutes, validateAuthConfig } from './auth.js';
import { stopTelegramBot } from './telegram/index.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export async function createApp() {
    const fastify = Fastify({
        logger: {
            level: 'info',
        },
        bodyLimit: 15 * 1024 * 1024, // 15MB for file sync/uploads
    });
    validateAuthConfig();
    function normalizeRequestPath(url) {
        const pathname = new URL(url, 'http://local').pathname;
        try {
            return decodeURIComponent(pathname).toLowerCase();
        }
        catch {
            return pathname.toLowerCase();
        }
    }
    function isBlockedPublicProbe(url) {
        let pathname = normalizeRequestPath(url);
        if (BASE_PATH && (pathname === BASE_PATH || pathname.startsWith(`${BASE_PATH}/`))) {
            pathname = pathname.slice(BASE_PATH.length) || '/';
        }
        return (pathname.startsWith('/@vite/') ||
            pathname.startsWith('/@fs/') ||
            pathname.startsWith('/__webpack') ||
            pathname.startsWith('/_next/webpack-hmr') ||
            /(?:^|\/)\./.test(pathname) ||
            /^\/(?:src|node_modules)(?:\/|$)/.test(pathname) ||
            /^\/(?:package(?:-lock)?\.json|vite\.config\.[^/]+|tsconfig(?:\.[^/]+)?\.json)$/.test(pathname));
    }
    fastify.addHook('onRequest', async (req, reply) => {
        if (isBlockedPublicProbe(req.url)) {
            return reply.status(404).send({ error: 'Endpoint or asset not found' });
        }
    });
    await fastify.register(cors, {
        origin: (origin, cb) => {
            if (!origin)
                return cb(null, true);
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
            }
            catch (_) { }
            return cb(null, false);
        },
        credentials: true,
    });
    // Global Security Headers
    fastify.addHook('onSend', async (_req, reply) => {
        reply.header('Content-Security-Policy', [
            "default-src 'self'",
            "script-src 'self'",
            "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
            "font-src 'self' data: https://cdn.jsdelivr.net",
            "img-src 'self' data: https:",
            "connect-src 'self' ws: wss:",
            "object-src 'none'",
            "base-uri 'self'",
            "form-action 'self'",
            "frame-ancestors 'self'",
        ].join('; '));
        reply.header('X-Content-Type-Options', 'nosniff');
        reply.header('X-Frame-Options', 'SAMEORIGIN');
        reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
        reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    });
    await fastify.register(fastifyWs);
    await fastify.register(multipart, {
        limits: {
            fileSize: 100 * 1024 * 1024, // 100MB per file
            files: 200,
        },
    });
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
        function getIndexHtml() {
            const indexPath = path.join(publicDir, 'index.html');
            if (!fs.existsSync(indexPath))
                return 'Frontend not built yet';
            const raw = fs.readFileSync(indexPath, 'utf8');
            return raw.replace(/<meta name="hugremote-base-path" content="[^"]*">/, `<meta name="hugremote-base-path" content="${BASE_PATH}">`);
        }
        function sendIndexHtml(reply) {
            reply.header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
            reply.header('Pragma', 'no-cache');
            reply.header('Expires', '0');
            return reply.type('text/html').send(getIndexHtml());
        }
        // Root and authentication HTML entries. Application navigation uses hashes.
        fastify.get('/', async (_req, reply) => sendIndexHtml(reply));
        fastify.get('/login', async (_req, reply) => sendIndexHtml(reply));
        await fastify.register(fastifyStatic, {
            root: publicDir,
            prefix: '/',
            index: false,
        });
        if (BASE_PATH) {
            fastify.get(`${BASE_PATH}/`, async (_req, reply) => sendIndexHtml(reply));
            fastify.get(`${BASE_PATH}/login`, async (_req, reply) => sendIndexHtml(reply));
            await fastify.register(fastifyStatic, {
                root: publicDir,
                prefix: `${BASE_PATH}/`,
                index: false,
                decorateReply: false,
            });
        }
        fastify.setNotFoundHandler((_req, reply) => {
            return reply.status(404).send({ error: 'Endpoint or asset not found' });
        });
    }
    fastify.addHook('onClose', async () => {
        await stopTelegramBot();
    });
    return fastify;
}
