import { createApp } from './app.js';
import { PORT, HOST, BASE_PATH } from './config/index.js';
import { startTelegramBot } from './telegram/index.js';
export async function startServer() {
    const app = await createApp();
    if (process.env.HUGREMOTE_DESKTOP_SECRET) {
        let closing = false;
        const shutdown = () => {
            if (closing)
                return;
            closing = true;
            const timeout = setTimeout(() => process.exit(1), 3000);
            timeout.unref();
            app.close().then(() => process.exit(0), () => process.exit(1));
        };
        process.once('SIGTERM', shutdown);
        process.once('SIGINT', shutdown);
    }
    try {
        await app.listen({ port: PORT, host: HOST });
        const baseMsg = BASE_PATH ? ` (Base path prefix: ${BASE_PATH})` : ' (No prefix)';
        console.log(`🚀 HugRemote Server running at http://${HOST}:${PORT}${baseMsg}`);
        // Kích hoạt Telegram Bot nếu có cấu hình TELEGRAM_BOT_TOKEN
        if (!process.env.HUGREMOTE_DESKTOP_SECRET)
            await startTelegramBot();
    }
    catch (err) {
        app.log.error(err);
        process.exit(1);
    }
}
if (process.argv[1] && (process.argv[1].endsWith('main.ts') || process.argv[1].endsWith('main.js') || process.argv[1].endsWith('index.js'))) {
    startServer();
}
