import { Bot } from 'grammy';
import { getTelegramConfig, isTelegramConfigured } from './config.js';
import { registerTelegramCommands } from './commands.js';

let botInstance: Bot | null = null;
let isRunning = false;

export function getBotInstance(): Bot | null {
  return botInstance;
}

export async function startTelegramBot(): Promise<void> {
  if (!isTelegramConfigured()) {
    console.log('[TelegramBot] TELEGRAM_BOT_TOKEN chưa được thiết lập. Tính năng Telegram Bot sẽ ở trạng thái chờ.');
    return;
  }

  const config = getTelegramConfig();

  try {
    const bot = new Bot(config.botToken);
    botInstance = bot;

    // 1. Zero-Trust Auth Guard Middleware
    bot.use(async (ctx, next) => {
      if (config.allowedUsers.length > 0) {
        const fromId = ctx.from?.id ? String(ctx.from.id) : '';
        const username = ctx.from?.username ? ctx.from.username.toLowerCase() : '';

        const isAllowed =
          config.allowedUsers.includes(fromId) ||
          (username && config.allowedUsers.includes(username));

        if (!isAllowed) {
          console.warn(`[TelegramBot] Từ chối truy cập từ User ID: ${fromId} (@${username || 'unknown'})`);
          try {
            await ctx.reply(
              `⛔ <b>Truy cập bị từ chối</b>\n` +
              `User ID của bạn: <code>${fromId}</code> chưa có trong danh sách được cấp phép sử dụng HugRemote.`,
              { parse_mode: 'HTML' }
            );
          } catch (_) {}
          return; // Stop execution chain
        }
      }

      await next();
    });

    // 2. Register all commands and message handlers
    registerTelegramCommands(bot);

    // 3. Global error handler
    bot.catch((err) => {
      console.error('[TelegramBot] Uncaught error in bot update handler:', err.error);
    });

    // 4. Start polling
    isRunning = true;
    bot.start({
      drop_pending_updates: true,
      onStart: (botInfo) => {
        console.log(`🤖 HugRemote Telegram Bot đã kích hoạt thành công: @${botInfo.username} (ID: ${botInfo.id})`);
      },
    }).catch((err) => {
      console.error('[TelegramBot] Polling loop error:', err);
      isRunning = false;
    });
  } catch (err: any) {
    console.error('[TelegramBot] Không thể khởi động Telegram Bot:', err.message);
  }
}

export async function stopTelegramBot(): Promise<void> {
  if (botInstance && isRunning) {
    console.log('[TelegramBot] Đang dừng Telegram Bot polling...');
    try {
      await botInstance.stop();
    } catch (_) {}
    isRunning = false;
    botInstance = null;
  }
}
