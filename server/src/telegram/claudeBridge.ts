import { Bot, Context } from 'grammy';
import { claudeService, ClaudeSession, ClaudeToolCall } from '../services/claudeService.js';
import { topicManager } from './topicManager.js';
import {
  escapeHtml,
  markdownToTelegramHtml,
  splitMessage,
  saveLongOutputToFile,
} from './formatter.js';

interface InFlightRun {
  sessionId: string;
  cancel: () => void;
}

const activeRuns: Map<string, InFlightRun> = new Map();

function formatStreamingCard(
  text: string,
  tools: ClaudeToolCall[],
  thinking?: string,
  isFinished = false
): string {
  const parts: string[] = [];

  // 1. Thinking / Progress banner
  if (!isFinished) {
    if (thinking) {
      parts.push(`🧠 <i>Đang suy nghĩ... (${thinking.length} ký tự)</i>\n`);
    } else {
      parts.push(`⏳ <i>Đang xử lý yêu cầu...</i>\n`);
    }
  }

  // 2. Tool calls card
  if (tools.length > 0) {
    parts.push(`🛠️ <b>Công cụ thực thi (${tools.length}):</b>`);
    for (const t of tools) {
      const icon = t.status === 'done' ? '✅' : t.status === 'error' ? '❌' : '⚡';
      const statusText = t.status === 'done' ? '<i>(xong)</i>' : t.status === 'error' ? '<i>(lỗi)</i>' : '<i>(đang chạy...)</i>';
      parts.push(`  ${icon} <code>${escapeHtml(t.title)}</code> ${statusText}`);
    }
    parts.push('');
  }

  // 3. Response text
  if (text && text.trim()) {
    parts.push(markdownToTelegramHtml(text));
  } else if (!isFinished && tools.length === 0) {
    parts.push('<i>Đang kết nối Claude CLI...</i>');
  }

  return parts.join('\n').trim();
}

/**
 * Executes a prompt for a given session and streams output live to Telegram.
 */
export async function executeAndStreamPrompt(
  bot: Bot,
  ctx: Context,
  session: ClaudeSession,
  prompt: string
) {
  const chatId = ctx.chat?.id;
  const threadId = ctx.message?.message_thread_id;
  if (!chatId) return;

  // Check if session is already running
  if (activeRuns.has(session.id)) {
    await ctx.reply(
      '⚠️ Phiên này đang bận xử lý một tác vụ khác. Gõ <code>/stop</code> để huỷ tác vụ hiện tại.',
      {
        parse_mode: 'HTML',
        message_thread_id: threadId,
      }
    );
    return;
  }

  // Register active run
  activeRuns.set(session.id, {
    sessionId: session.id,
    cancel: () => claudeService.cancelRun(session.id),
  });

  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  // 1. Save user message to session
  const userMsg = {
    id: `msg-${Date.now()}-u`,
    sender: 'user' as const,
    text: prompt.trim(),
    time: timeStr,
  };
  claudeService.addMessage(session.id, userMsg);

  // 2. Send initial placeholder message
  let statusMessageId: number | null = null;
  try {
    const placeholder = await ctx.reply('⏳ <i>Đang khởi tạo Claude Code...</i>', {
      parse_mode: 'HTML',
      message_thread_id: threadId,
    });
    statusMessageId = placeholder.message_id;
  } catch (err) {
    console.error('[ClaudeBridge] Failed to send initial placeholder:', err);
  }

  // Streaming state
  let currentText = '';
  let currentThinking = '';
  const currentTools: ClaudeToolCall[] = [];
  let isDone = false;
  let lastEditTime = 0;
  let editTimer: NodeJS.Timeout | null = null;
  const MIN_EDIT_INTERVAL = 1200; // Telegram safe debounce threshold

  const doEdit = async (force = false) => {
    if (!statusMessageId) return;
    const now = Date.now();
    if (!force && now - lastEditTime < MIN_EDIT_INTERVAL) {
      if (!editTimer) {
        editTimer = setTimeout(() => {
          editTimer = null;
          doEdit();
        }, MIN_EDIT_INTERVAL - (now - lastEditTime));
      }
      return;
    }

    lastEditTime = now;
    const content = formatStreamingCard(currentText, currentTools, currentThinking, isDone);
    if (!content) return;

    // Guard length limit for single Telegram edit
    const safeContent = content.length > 3800 ? content.slice(0, 3800) + '\n\n<i>...(đang cập nhật tiếp)...</i>' : content;

    try {
      await bot.api.editMessageText(chatId, statusMessageId, safeContent, {
        parse_mode: 'HTML',
      });
    } catch (err: any) {
      const msg = err?.message || '';
      // Ignore Telegram benign errors
      if (msg.includes('message is not modified')) return;
      if (msg.includes('retry after') || msg.includes('Too Many Requests')) return;

      // Fallback: if HTML parsing failed, send plain text
      try {
        const plain = safeContent.replace(/<[^>]+>/g, '');
        await bot.api.editMessageText(chatId, statusMessageId, plain);
      } catch (_) {}
    }
  };

  try {
    // 3. Stream from Claude CLI
    const result = await claudeService.streamClaudePrompt(session, prompt.trim(), (event) => {
      switch (event.type) {
        case 'thinking':
          currentThinking = event.text;
          doEdit();
          break;
        case 'tool_use':
          currentTools.push(event.tool);
          doEdit();
          break;
        case 'tool_result': {
          const found = currentTools.find((t) => t.id === event.tool_use_id);
          if (found) {
            found.output = event.output;
            found.status = event.status;
          }
          doEdit();
          break;
        }
        case 'text_delta':
          currentText += event.text;
          doEdit();
          break;
        case 'done':
          if (event.text) currentText = event.text;
          isDone = true;
          break;
        case 'error':
          currentText += `\n❌ <b>Lỗi:</b> ${escapeHtml(event.error)}`;
          isDone = true;
          break;
      }
    });

    isDone = true;
    if (editTimer) {
      clearTimeout(editTimer);
      editTimer = null;
    }

    // 4. Save assistant response to session
    const asstMsg = {
      id: `msg-${Date.now()}-a`,
      sender: 'assistant' as const,
      text: result.text || currentText,
      time: timeStr,
      thinking: result.thinking || currentThinking || undefined,
      tools: result.tools?.length ? result.tools : currentTools.length ? currentTools : undefined,
    };
    claudeService.addMessage(session.id, asstMsg);

    // 5. Final message presentation
    const finalFullText = result.text || currentText;

    if (finalFullText.length > 3800) {
      // Long output: Save full text to file server and show summary with link
      const saved = saveLongOutputToFile('claude', finalFullText, 'md');
      const head = formatStreamingCard(finalFullText.slice(0, 2500), currentTools, undefined, true);
      const summaryWithLink = `${head}\n\n⚠️ <b>Câu trả lời dài (${finalFullText.length} ký tự).</b>\n📎 <b>Xem nội dung đầy đủ:</b> <a href="${saved.fileUrl}">${saved.fileUrl}</a>`;

      try {
        if (statusMessageId) {
          await bot.api.editMessageText(chatId, statusMessageId, summaryWithLink, {
            parse_mode: 'HTML',
          });
        }
      } catch (_) {
        await ctx.reply(summaryWithLink, {
          parse_mode: 'HTML',
          message_thread_id: threadId,
        });
      }
    } else {
      // Normal length: flush final edit
      await doEdit(true);
    }

    // 6. Best-effort auto-rename topic on first interaction
    if (threadId && threadId !== 1 && !session.isCustomNamed) {
      try {
        const words = prompt.trim().split(/\s+/).slice(0, 6).join(' ');
        const cleanTitle = words.replace(/[\/\\#*`]/g, '').trim();
        if (cleanTitle) {
          topicManager.autoRenameTopic(bot.api, chatId, threadId, cleanTitle);
          claudeService.updateSession(session.id, { name: cleanTitle });
        }
      } catch (_) {}
    }
  } catch (err: any) {
    console.error('[ClaudeBridge] Execution error:', err);
    await ctx.reply(`❌ <b>Lỗi thực thi:</b> ${escapeHtml(err.message || 'Lỗi không xác định')}`, {
      parse_mode: 'HTML',
      message_thread_id: threadId,
    });
  } finally {
    activeRuns.delete(session.id);
  }
}
