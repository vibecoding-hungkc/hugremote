import { createApp } from './app.js';
import { PORT, HOST, BASE_PATH } from './config/index.js';
import { startTelegramBot } from './telegram/index.js';

export async function startServer() {
  const app = await createApp();
  try {
    await app.listen({ port: PORT, host: HOST });
    const baseMsg = BASE_PATH ? ` (Base path prefix: ${BASE_PATH})` : ' (No prefix)';
    console.log(`🚀 HugRemote Server running at http://${HOST}:${PORT}${baseMsg}`);

    // Kích hoạt Telegram Bot nếu có cấu hình TELEGRAM_BOT_TOKEN
    await startTelegramBot();
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

if (process.argv[1] && (process.argv[1].endsWith('main.ts') || process.argv[1].endsWith('main.js') || process.argv[1].endsWith('index.js'))) {
  startServer();
}
