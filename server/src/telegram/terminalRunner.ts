import { exec } from 'child_process';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { CommandExecutionResult } from './types.js';
import { escapeHtml, saveLongOutputToFile } from './formatter.js';

export async function runTerminalCommand(
  cmd: string,
  cwd?: string,
  timeoutMs = 60000
): Promise<CommandExecutionResult> {
  const startTime = Date.now();
  let resolvedCwd = cwd || os.homedir();

  if (resolvedCwd.startsWith('~')) {
    resolvedCwd = path.join(os.homedir(), resolvedCwd.slice(1));
  }
  if (!fs.existsSync(resolvedCwd)) {
    resolvedCwd = os.homedir();
  }

  return new Promise((resolve) => {
    exec(
      cmd,
      {
        cwd: resolvedCwd,
        timeout: timeoutMs,
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
        env: {
          ...process.env,
          TERM: 'xterm-256color',
          PATH: `${path.join(os.homedir(), '.local', 'bin')}:${process.env.PATH}`,
        },
      },
      (error, stdout, stderr) => {
        const durationMs = Date.now() - startTime;
        const exitCode = error ? (error.code ?? 1) : 0;
        const fullOutput = stdout + (stderr ? (stdout ? '\n' : '') + stderr : '');

        let outputFileUrl: string | undefined;

        // If output is long, save to file server and generate link
        if (fullOutput.length > 3500) {
          const saved = saveLongOutputToFile('term', fullOutput, 'log');
          if (saved.fileUrl) {
            outputFileUrl = saved.fileUrl;
          }
        }

        resolve({
          stdout: stdout || '',
          stderr: stderr || '',
          exitCode,
          durationMs,
          outputFileUrl,
        });
      }
    );
  });
}

export function formatTerminalResponse(
  command: string,
  cwd: string,
  result: CommandExecutionResult
): string {
  const statusEmoji = result.exitCode === 0 ? '✅' : '❌';
  const durationStr = `${result.durationMs}ms`;
  const combined = result.stdout + (result.stderr ? (result.stdout ? '\n' : '') + result.stderr : '');

  let body = '';
  if (!combined.trim()) {
    body = '<i>(Lệnh chạy thành công, không có dữ liệu trả về)</i>';
  } else if (result.outputFileUrl) {
    const head = combined.slice(0, 2000);
    body = `<pre><code>${escapeHtml(head)}</code></pre>\n\n⚠️ <i>Dữ liệu quá dài (${combined.length} ký tự).</i>\n📎 <b>Xem log đầy đủ:</b> <a href="${result.outputFileUrl}">${result.outputFileUrl}</a>`;
  } else {
    body = `<pre><code>${escapeHtml(combined.trimEnd())}</code></pre>`;
  }

  return [
    `💻 <b>Terminal Execution</b>`,
    `📂 <code>${escapeHtml(cwd)}</code>`,
    `⌨️ <code>${escapeHtml(command)}</code>`,
    `${statusEmoji} <b>Mã thoát:</b> <code>${result.exitCode ?? 0}</code> (${durationStr})`,
    '',
    body,
  ].join('\n');
}
