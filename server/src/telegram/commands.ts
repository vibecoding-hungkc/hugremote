import { Bot, Context } from 'grammy';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { claudeService, ClaudeSession } from '../services/claudeService.js';
import { topicManager } from './topicManager.js';
import { getTelegramConfig } from './config.js';
import { runTerminalCommand, formatTerminalResponse } from './terminalRunner.js';
import { executeAndStreamPrompt } from './claudeBridge.js';
import { escapeHtml } from './formatter.js';

export function resolveSessionForContext(ctx: Context): ClaudeSession | null {
  const chatId = String(ctx.chat?.id || '');
  const threadId = ctx.message?.message_thread_id ? String(ctx.message.message_thread_id) : undefined;
  const config = getTelegramConfig();

  // 1. If in a specific topic / thread (not General / threadId !== "1")
  if (threadId && threadId !== '1') {
    const binding = topicManager.getBinding(chatId, threadId);
    if (binding) {
      const found = claudeService.getSession(binding.sessionId);
      if (found) return found;
    }

    // Auto-create a session for this new topic
    const newSession = claudeService.createSession(
      'server-local',
      `topic-${threadId}`,
      config.defaultCwd,
      'Sonnet 5.5 Medium',
      'Auto',
      undefined,
      true
    );
    topicManager.bind(chatId, threadId, newSession.id, newSession.name);
    return newSession;
  }

  // 2. If in root DM / General topic
  // Return most recently updated session if exists, or null
  const sessions = claudeService.getSessionsForServer('server-local', config.defaultCwd);
  if (sessions.length > 0) {
    return sessions[0];
  }

  return null;
}

export function registerTelegramCommands(bot: Bot) {
  const config = getTelegramConfig();

  // 1. /start & /help
  bot.command(['start', 'help'], async (ctx) => {
    const threadId = ctx.message?.message_thread_id;
    const helpText = [
      `🐴 <b>Chào mừng bạn đến với HugRemote Bot!</b>`,
      `Điều khiển Claude Code và Terminal từ xa trên điện thoại qua Telegram.`,
      '',
      `🔹 <b>Quản lý Phiên (Session):</b>`,
      `• <code>/new [tên] [thư_mục]</code> : Tạo phiên Claude mới (tự động gán vào Topic).`,
      `• <code>/resume [id]</code> : Tiếp tục / liên kết phiên làm việc cũ.`,
      `• <code>/compact</code> : Nén & tóm tắt ngữ cảnh hội thoại hiện tại.`,
      `• <code>/clear</code> : Xóa sạch tin nhắn của phiên hiện tại.`,
      `• <code>/stop</code> (alias <code>/abort</code>) : Dừng ngay tác vụ Claude đang chạy.`,
      `• <code>/status</code> : Xem trạng thái phiên và giới hạn hạn ngạch (quota) Claude.`,
      `• <code>/sessions</code> : Xem danh sách tất cả các phiên làm việc.`,
      '',
      `🔹 <b>Thực thi Terminal & Hệ thống:</b>`,
      `• <code>/terminal &lt;lệnh&gt;</code> (hoặc <code>/sh</code>) : Chạy lệnh shell trực tiếp tại thư mục làm việc.`,
      `• <code>/cd &lt;đường_dẫn&gt;</code> : Đổi thư mục làm việc của phiên.`,
      `• <code>/pwd</code> : Xem thư mục làm việc hiện tại.`,
      '',
      `🔹 <b>Chế độ Topic (Forum / Threaded Mode):</b>`,
      `• <code>/topic on|off</code> : Bật / tắt chế độ mỗi Topic là 1 phiên độc lập.`,
      `• <code>/topic &lt;session_id&gt;</code> : Gán Topic hiện tại vào một phiên cụ thể.`,
      '',
      `💡 <i>Mẹo: Trong chế độ Topic, mở bất kỳ Topic nào để bắt đầu trao đổi độc lập với Claude Code!</i>`,
    ].join('\n');

    await ctx.reply(helpText, {
      parse_mode: 'HTML',
      message_thread_id: threadId,
    });
  });

  // 2. /new [name] [cwd]
  bot.command('new', async (ctx) => {
    const chatId = String(ctx.chat?.id || '');
    const threadId = ctx.message?.message_thread_id ? String(ctx.message.message_thread_id) : undefined;
    const text = (ctx.match || '').trim();
    const parts = text.split(/\s+/).filter(Boolean);

    let sessionName = parts[0] || (threadId ? `topic-${threadId}` : 'chat');
    let sessionCwd = parts[1] || config.defaultCwd;

    if (sessionCwd.startsWith('~')) {
      sessionCwd = path.join(os.homedir(), sessionCwd.slice(1));
    } else if (!path.isAbsolute(sessionCwd)) {
      sessionCwd = path.resolve(config.defaultCwd, sessionCwd);
    }
    if (!fs.existsSync(sessionCwd)) {
      try {
        fs.mkdirSync(sessionCwd, { recursive: true });
      } catch (_) {
        sessionCwd = os.homedir();
      }
    }

    const session = claudeService.createSession(
      'server-local',
      sessionName,
      sessionCwd,
      'Sonnet 5.5 Medium',
      'Auto',
      undefined,
      true
    );

    if (threadId && threadId !== '1') {
      topicManager.bind(chatId, threadId, session.id, session.name);
    }

    const replyMsg = [
      `✨ <b>Đã tạo phiên Claude mới!</b>`,
      `• <b>ID:</b> <code>${escapeHtml(session.id)}</code>`,
      `• <b>Tên:</b> <code>${escapeHtml(session.name)}</code>`,
      `• <b>Thư mục (CWD):</b> <code>${escapeHtml(session.cwd)}</code>`,
      `• <b>Model:</b> <code>${escapeHtml(session.model)}</code>`,
      threadId && threadId !== '1' ? `• <b>Topic:</b> Đã gán vào topic này.` : ``,
      '',
      `Bây giờ bạn có thể gửi prompt trực tiếp để làm việc!`,
    ].filter(Boolean).join('\n');

    await ctx.reply(replyMsg, {
      parse_mode: 'HTML',
      message_thread_id: ctx.message?.message_thread_id,
    });
  });

  // 3. /resume [id]
  bot.command('resume', async (ctx) => {
    const chatId = String(ctx.chat?.id || '');
    const threadId = ctx.message?.message_thread_id ? String(ctx.message.message_thread_id) : undefined;
    const targetId = (ctx.match || '').trim();

    if (!targetId) {
      // List sessions with quick instructions
      const sessions = claudeService.getSessionsForServer('server-local', config.defaultCwd);
      if (sessions.length === 0) {
        return ctx.reply('Chưa có phiên làm việc nào. Gõ <code>/new</code> để tạo phiên mới.', {
          parse_mode: 'HTML',
          message_thread_id: ctx.message?.message_thread_id,
        });
      }

      const lines = [
        `📋 <b>Chọn phiên để tiếp tục:</b>`,
        `Gõ <code>/resume &lt;id&gt;</code> để tiếp tục phiên mong muốn:`,
        '',
      ];
      for (const s of sessions.slice(0, 10)) {
        const time = new Date(s.updatedAt).toLocaleString('vi-VN', { hour12: false });
        lines.push(`• <code>${escapeHtml(s.id)}</code> - <b>${escapeHtml(s.name)}</b>`);
        lines.push(`  📂 <code>${escapeHtml(path.basename(s.cwd))}</code> | 💬 ${s.messages?.length || 0} tin | 🕒 ${time}`);
      }

      return ctx.reply(lines.join('\n'), {
        parse_mode: 'HTML',
        message_thread_id: ctx.message?.message_thread_id,
      });
    }

    // Try full match or prefix match
    const sessions = claudeService.getSessionsForServer('server-local', config.defaultCwd);
    const found = sessions.find((s) => s.id === targetId || s.id.toLowerCase().includes(targetId.toLowerCase()));

    if (!found) {
      return ctx.reply(`❌ Không tìm thấy phiên nào khớp với: <code>${escapeHtml(targetId)}</code>`, {
        parse_mode: 'HTML',
        message_thread_id: ctx.message?.message_thread_id,
      });
    }

    if (threadId && threadId !== '1') {
      topicManager.bind(chatId, threadId, found.id, found.name);
    }

    const replyMsg = [
      `🔄 <b>Đã kết nối lại phiên:</b>`,
      `• <b>ID:</b> <code>${escapeHtml(found.id)}</code>`,
      `• <b>Tên:</b> <b>${escapeHtml(found.name)}</b>`,
      `• <b>CWD:</b> <code>${escapeHtml(found.cwd)}</code>`,
      `• <b>Tokens:</b> <code>${found.contextTokens || '0'}</code>`,
      `• <b>Số tin nhắn:</b> ${found.messages?.length || 0}`,
    ].join('\n');

    await ctx.reply(replyMsg, {
      parse_mode: 'HTML',
      message_thread_id: ctx.message?.message_thread_id,
    });
  });

  // 4. /compact
  bot.command('compact', async (ctx) => {
    const session = resolveSessionForContext(ctx);
    if (!session) {
      return ctx.reply('Chưa có phiên nào được kích hoạt. Hãy tạo phiên bằng <code>/new</code>.', {
        parse_mode: 'HTML',
        message_thread_id: ctx.message?.message_thread_id,
      });
    }

    const prompt = '/compact Hãy tóm tắt và nén toàn bộ ngữ cảnh hội thoại hiện tại, giữ lại các file đã sửa, quyết định kiến trúc và trạng thái tiếp theo.';
    await ctx.reply(`📦 <i>Đang thực hiện nén ngữ cảnh cho phiên: <b>${escapeHtml(session.name)}</b>...</i>`, {
      parse_mode: 'HTML',
      message_thread_id: ctx.message?.message_thread_id,
    });

    await executeAndStreamPrompt(bot, ctx, session, prompt);
  });

  // 5. /clear
  bot.command('clear', async (ctx) => {
    const session = resolveSessionForContext(ctx);
    if (!session) {
      return ctx.reply('Chưa có phiên nào được kích hoạt.', {
        parse_mode: 'HTML',
        message_thread_id: ctx.message?.message_thread_id,
      });
    }

    claudeService.clearMessages(session.id);
    await ctx.reply(`🧹 Đã xóa sạch lịch sử tin nhắn của phiên <b>${escapeHtml(session.name)}</b>. Thư mục làm việc vẫn giữ nguyên: <code>${escapeHtml(session.cwd)}</code>.`, {
      parse_mode: 'HTML',
      message_thread_id: ctx.message?.message_thread_id,
    });
  });

  // 6. /stop or /abort or /cancel
  bot.command(['stop', 'abort', 'cancel'], async (ctx) => {
    const session = resolveSessionForContext(ctx);
    if (!session) {
      return ctx.reply('Không có phiên nào đang mở.', {
        parse_mode: 'HTML',
        message_thread_id: ctx.message?.message_thread_id,
      });
    }

    const stopped = claudeService.cancelRun(session.id);
    if (stopped) {
      await ctx.reply(`🛑 Đã gửi lệnh dừng tiến trình cho phiên <b>${escapeHtml(session.name)}</b>.`, {
        parse_mode: 'HTML',
        message_thread_id: ctx.message?.message_thread_id,
      });
    } else {
      await ctx.reply(`ℹ️ Không có tiến trình Claude nào đang chạy trong phiên này.`, {
        parse_mode: 'HTML',
        message_thread_id: ctx.message?.message_thread_id,
      });
    }
  });

  // 7. /status (alias /limits)
  bot.command(['status', 'limits'], async (ctx) => {
    const session = resolveSessionForContext(ctx);
    const limits = claudeService.getLimits();

    const limitLines = [
      `📊 <b>Hạn mức Claude (Quota):</b>`,
      `• <b>5 Giờ:</b> ${limits.fiveHour.usedPercent}% <i>(reset sau ${limits.fiveHour.resetIn})</i>`,
      `• <b>Tuần:</b> ${limits.weekly.usedPercent}% <i>(reset sau ${limits.weekly.resetIn})</i>`,
    ];

    let sessionLines: string[] = [];
    if (session) {
      sessionLines = [
        `\n🎯 <b>Phiên hiện tại:</b>`,
        `• <b>ID:</b> <code>${escapeHtml(session.id)}</code>`,
        `• <b>Tên:</b> <b>${escapeHtml(session.name)}</b>`,
        `• <b>CWD:</b> <code>${escapeHtml(session.cwd)}</code>`,
        `• <b>Model:</b> <code>${escapeHtml(session.model)}</code>`,
        `• <b>Context Tokens:</b> <code>${session.contextTokens || '0'}</code>`,
        `• <b>Tin nhắn:</b> ${session.messages?.length || 0}`,
      ];
    } else {
      sessionLines = ['\n<i>(Chưa kết nối vào phiên cụ thể nào. Gõ /new để tạo phiên)</i>'];
    }

    await ctx.reply([...limitLines, ...sessionLines].join('\n'), {
      parse_mode: 'HTML',
      message_thread_id: ctx.message?.message_thread_id,
    });
  });

  // 8. /sessions or /ls
  bot.command(['sessions', 'ls'], async (ctx) => {
    const sessions = claudeService.getSessionsForServer('server-local', config.defaultCwd);
    if (sessions.length === 0) {
      return ctx.reply('Chưa có phiên làm việc nào. Gõ <code>/new</code> để tạo mới.', {
        parse_mode: 'HTML',
        message_thread_id: ctx.message?.message_thread_id,
      });
    }

    const lines = [`📁 <b>Danh sách phiên làm việc (${sessions.length}):</b>\n`];
    for (const s of sessions.slice(0, 15)) {
      const time = new Date(s.updatedAt).toLocaleString('vi-VN', { hour12: false });
      lines.push(`• <b>${escapeHtml(s.name)}</b> (<code>${escapeHtml(s.id.slice(-8))}</code>)`);
      lines.push(`  📂 <code>${escapeHtml(path.basename(s.cwd))}</code> | 💬 ${s.messages?.length || 0} tin | 🕒 ${time}`);
    }

    lines.push('\n<i>Tip: Gõ /resume &lt;id&gt; để chọn phiên.</i>');

    await ctx.reply(lines.join('\n'), {
      parse_mode: 'HTML',
      message_thread_id: ctx.message?.message_thread_id,
    });
  });

  // 9. /terminal <cmd> or /sh <cmd> or /exec <cmd>
  bot.command(['terminal', 'sh', 'exec'], async (ctx) => {
    const command = (ctx.match || '').trim();
    if (!command) {
      return ctx.reply('Vui lòng nhập lệnh cần chạy. Ví dụ: <code>/terminal git status</code>', {
        parse_mode: 'HTML',
        message_thread_id: ctx.message?.message_thread_id,
      });
    }

    const session = resolveSessionForContext(ctx);
    const cwd = session ? session.cwd : config.defaultCwd;

    const waitingMsg = await ctx.reply(`⚡ <i>Đang thực thi lệnh trong <code>${escapeHtml(cwd)}</code>...</i>`, {
      parse_mode: 'HTML',
      message_thread_id: ctx.message?.message_thread_id,
    });

    const result = await runTerminalCommand(command, cwd);
    const formatted = formatTerminalResponse(command, cwd, result);

    try {
      await bot.api.editMessageText(ctx.chat.id, waitingMsg.message_id, formatted, {
        parse_mode: 'HTML',
      });
    } catch (_) {
      await ctx.reply(formatted, {
        parse_mode: 'HTML',
        message_thread_id: ctx.message?.message_thread_id,
      });
    }
  });

  // 10. /cd <path>
  bot.command('cd', async (ctx) => {
    const target = (ctx.match || '').trim();
    if (!target) {
      return ctx.reply('Vui lòng nhập đường dẫn. Ví dụ: <code>/cd /home/hermes-admin/projects</code>', {
        parse_mode: 'HTML',
        message_thread_id: ctx.message?.message_thread_id,
      });
    }

    const session = resolveSessionForContext(ctx);
    if (!session) {
      return ctx.reply('Chưa có phiên nào được kích hoạt. Gõ <code>/new</code> trước.', {
        parse_mode: 'HTML',
        message_thread_id: ctx.message?.message_thread_id,
      });
    }

    let resolved = target;
    if (resolved.startsWith('~')) {
      resolved = path.join(os.homedir(), resolved.slice(1));
    } else if (!path.isAbsolute(resolved)) {
      resolved = path.resolve(session.cwd, resolved);
    }

    if (!fs.existsSync(resolved)) {
      return ctx.reply(`❌ Thư mục không tồn tại: <code>${escapeHtml(resolved)}</code>`, {
        parse_mode: 'HTML',
        message_thread_id: ctx.message?.message_thread_id,
      });
    }

    claudeService.updateSession(session.id, { cwd: resolved });
    await ctx.reply(`📂 Đã chuyển thư mục làm việc của phiên <b>${escapeHtml(session.name)}</b> sang: <code>${escapeHtml(resolved)}</code>`, {
      parse_mode: 'HTML',
      message_thread_id: ctx.message?.message_thread_id,
    });
  });

  // 11. /pwd
  bot.command('pwd', async (ctx) => {
    const session = resolveSessionForContext(ctx);
    const cwd = session ? session.cwd : config.defaultCwd;
    await ctx.reply(`📂 <b>Thư mục hiện tại:</b> <code>${escapeHtml(cwd)}</code>`, {
      parse_mode: 'HTML',
      message_thread_id: ctx.message?.message_thread_id,
    });
  });

  // 12. /topic [on|off|<session_id>]
  bot.command('topic', async (ctx) => {
    const chatId = String(ctx.chat?.id || '');
    const threadId = ctx.message?.message_thread_id ? String(ctx.message.message_thread_id) : undefined;
    const arg = (ctx.match || '').trim().toLowerCase();

    if (arg === 'on') {
      topicManager.setTopicMode(chatId, true);
      return ctx.reply('✅ Đã <b>BẬT</b> chế độ Topic Mode. Mỗi Topic Telegram giờ là một phiên Claude độc lập!', {
        parse_mode: 'HTML',
        message_thread_id: ctx.message?.message_thread_id,
      });
    }

    if (arg === 'off') {
      topicManager.setTopicMode(chatId, false);
      return ctx.reply('⚠️ Đã <b>TẮT</b> chế độ Topic Mode. Tin nhắn sẽ sử dụng phiên chung mặc định.', {
        parse_mode: 'HTML',
        message_thread_id: ctx.message?.message_thread_id,
      });
    }

    if (arg) {
      // Bind current thread to session_id
      if (!threadId || threadId === '1') {
        return ctx.reply('Vui lòng chạy lệnh này bên trong một Topic cụ thể để gán phiên.', {
          message_thread_id: ctx.message?.message_thread_id,
        });
      }
      const session = claudeService.getSession(arg);
      if (!session) {
        return ctx.reply(`❌ Không tìm thấy phiên: <code>${escapeHtml(arg)}</code>`, {
          parse_mode: 'HTML',
          message_thread_id: ctx.message?.message_thread_id,
        });
      }
      topicManager.bind(chatId, threadId, session.id, session.name);
      return ctx.reply(`🔗 Đã gán Topic này vào phiên: <b>${escapeHtml(session.name)}</b> (<code>${escapeHtml(session.id)}</code>).`, {
        parse_mode: 'HTML',
        message_thread_id: ctx.message?.message_thread_id,
      });
    }

    // No argument: show current topic status
    const isEnabled = topicManager.isTopicModeEnabled(chatId);
    let topicInfo = `📌 <b>Topic Mode:</b> ${isEnabled ? 'BẬT (Enabled)' : 'TẮT (Disabled)'}\n`;

    if (threadId && threadId !== '1') {
      const binding = topicManager.getBinding(chatId, threadId);
      if (binding) {
        topicInfo += `• <b>Topic hiện tại (${threadId}):</b> Đang gắn với phiên <code>${escapeHtml(binding.sessionId)}</code> (<b>${escapeHtml(binding.sessionName || '')}</b>)`;
      } else {
        topicInfo += `• <b>Topic hiện tại (${threadId}):</b> Chưa gắn với phiên cụ thể nào.`;
      }
    } else {
      topicInfo += `• Bạn đang ở <b>Root Chat / Control Lobby</b>. Tạo một Topic mới hoặc vào Topic cụ thể để chat riêng rẽ.`;
    }

    await ctx.reply(topicInfo, {
      parse_mode: 'HTML',
      message_thread_id: ctx.message?.message_thread_id,
    });
  });

  // 13. Regular Text Messages -> Claude Prompt
  bot.on('message:text', async (ctx) => {
    const text = ctx.message.text.trim();
    if (text.startsWith('/')) return; // Handled by command handlers

    const chatId = String(ctx.chat.id);
    const threadId = ctx.message.message_thread_id ? String(ctx.message.message_thread_id) : undefined;
    const isTopicMode = topicManager.isTopicModeEnabled(chatId);

    // If in root DM and Topic Mode is on: Remind user to use a topic (like Hermes Agent lobby)
    if (isTopicMode && (!threadId || threadId === '1')) {
      return ctx.reply(
        '💬 <b>Bạn đang ở kênh chính (Lobby).</b>\n\n' +
        'Chế độ Topic Mode đang bật. Để chat với Claude Code một cách độc lập:\n' +
        '1. Hãy tạo hoặc mở một <b>Topic</b> mới.\n' +
        '2. Gửi tin nhắn vào Topic đó để bắt đầu làm việc.\n\n' +
        '<i>(Các lệnh hệ thống như <code>/terminal</code>, <code>/status</code>, <code>/sessions</code> vẫn chạy được ở đây)</i>',
        {
          parse_mode: 'HTML',
          message_thread_id: ctx.message.message_thread_id,
        }
      );
    }

    const session = resolveSessionForContext(ctx);
    if (!session) {
      return ctx.reply('Chưa có phiên làm việc nào. Gõ <code>/new</code> để bắt đầu!', {
        parse_mode: 'HTML',
        message_thread_id: ctx.message.message_thread_id,
      });
    }

    await executeAndStreamPrompt(bot, ctx, session, text);
  });
}
