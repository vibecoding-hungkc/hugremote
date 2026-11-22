import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { execFile, spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { DataSource } from 'typeorm';
import { ErrorCode } from '@app/shared';
import { AppError } from '../../common/app-error';
import { APP_CONFIG } from '../../config/app-config';
import type { AppConfig } from '../../config/app-config';
import { ClaudeService } from '../claude/claude.service';
import { TerminalService } from '../terminal/terminal.service';

interface RunStatus {
  runId: string;
  from: string;
  to: string;
  status: 'running' | 'done' | 'failed' | 'rolled_back';
  steps: { name: string; status: string }[];
  at: string;
}

/**
 * Cập nhật trong app (AC-31): kênh = tag git của UPDATE_REPO; cập nhật chạy ở `bin/isolated-update.sh` tách rời
 * (sống qua lúc api khởi động lại). "Khi rảnh" = chờ tới khi không còn phiên Claude/terminal chạy.
 */
@Injectable()
export class UpdaterService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('Update');
  private latestCache?: { at: number; tag: string | null };
  private waiting: { channel: string; runId: string } | null = null;
  private timer?: NodeJS.Timeout;

  constructor(
    @Inject(APP_CONFIG) private readonly cfg: AppConfig,
    private readonly ds: DataSource,
    private readonly claude: ClaudeService,
    private readonly terminals: TerminalService,
  ) {}

  private get installRoot() {
    return process.env.INSTALL_ROOT || path.join(os.homedir(), '.local/share/hugremote');
  }
  private get statusFile() {
    return path.join(this.cfg.dataDir, 'update-status.json');
  }
  /** Bản đang chạy theo symlink `current`; null = bản dev (không cài bằng install.sh). */
  current(): string | null {
    try {
      return path.basename(fs.readlinkSync(path.join(this.installRoot, 'current')));
    } catch {
      return null;
    }
  }

  onModuleInit() {
    this.timer = setInterval(() => void this.tick(), 10_000);
    this.timer.unref();
  }
  onModuleDestroy() {
    clearInterval(this.timer);
  }

  private bin() {
    return path.join(this.installRoot, 'current', 'bin');
  }

  latest(): Promise<string | null> {
    if (this.latestCache && Date.now() - this.latestCache.at < 10 * 60_000) return Promise.resolve(this.latestCache.tag);
    if (!this.cfg.updateRepo || !this.current()) return Promise.resolve(null);
    const script = `. "${this.bin()}/lib/release.sh"; latest_tag ${this.cfg.updateChannel}`;
    return new Promise((resolve) =>
      execFile('bash', ['-c', script], { env: { ...process.env, UPDATE_REPO: this.cfg.updateRepo }, timeout: 20_000 }, (err, out) => {
        const tag = err ? null : out.toString().trim() || null;
        this.latestCache = { at: Date.now(), tag };
        resolve(tag);
      }),
    );
  }

  run(): RunStatus | null {
    try {
      return JSON.parse(fs.readFileSync(this.statusFile, 'utf8')) as RunStatus;
    } catch {
      return null;
    }
  }

  running() {
    return { claude: this.claude.runningCount(), terminal: this.terminals.runningCount() };
  }

  async state() {
    const cur = this.current();
    const latest = await this.latest();
    const run = this.run();
    return {
      installed: !!cur,
      current: cur ?? `dev (${this.cfg.env})`,
      channel: this.cfg.updateChannel,
      latest: latest && latest !== cur ? latest : null,
      run,
      waiting: !!this.waiting,
      running: this.running(),
    };
  }

  /** Bấm lần hai khi đang chạy/đang chờ → 409 UPDATE_IN_PROGRESS. */
  async start(when: 'now' | 'idle') {
    if (!this.current()) throw AppError.badRequest(ErrorCode.VALIDATION_FAILED, { reason: 'Bản dev — cập nhật bằng git pull + make' });
    if (this.waiting || this.run()?.status === 'running') throw AppError.conflict(ErrorCode.UPDATE_IN_PROGRESS);
    const tag = await this.latest();
    if (!tag || tag === this.current()) throw AppError.badRequest(ErrorCode.VALIDATION_FAILED, { reason: 'Đang ở bản mới nhất' });
    const runId = Date.now().toString(36);
    await this.record(runId, tag, when === 'idle' ? 'waiting' : 'running', when);
    if (when === 'idle') {
      this.waiting = { channel: this.cfg.updateChannel, runId };
      this.log.log(`Hẹn cập nhật lên ${tag} khi không còn phiên chạy`);
      return this.state();
    }
    this.launch(tag, runId);
    return this.state();
  }

  cancelWaiting() {
    this.waiting = null;
  }

  private async tick() {
    const r = this.run();
    if (r && r.status !== 'running')
      await this.ds
        .query(`UPDATE update_runs SET status=?, steps=?, finished_at=? WHERE id=? AND finished_at IS NULL`, [
          r.status,
          JSON.stringify(r.steps),
          r.at,
          r.runId,
        ])
        .catch(() => undefined);
    if (!this.waiting) return;
    const n = this.running();
    if (n.claude + n.terminal > 0) return;
    const tag = await this.latest();
    const w = this.waiting;
    this.waiting = null;
    if (tag) this.launch(tag, w.runId);
  }

  private launch(tag: string, runId: string) {
    // chép script ra ngoài thư mục bản đang chạy, chạy tách rời (sống qua lúc api khởi động lại)
    const work = fs.mkdtempSync(path.join(os.tmpdir(), 'hugremote-update-'));
    fs.cpSync(this.bin(), path.join(work, 'bin'), { recursive: true });
    fs.writeFileSync(
      this.statusFile,
      JSON.stringify({ runId, from: this.current(), to: tag, status: 'running', steps: [], at: new Date().toISOString() }),
    );
    const child = spawn('bash', [path.join(work, 'bin', 'isolated-update.sh'), tag, runId], {
      env: { ...process.env, DATA_DIR: this.cfg.dataDir, INSTALL_ROOT: this.installRoot },
      detached: true,
      stdio: 'ignore',
    });
    child.unref();
    this.log.log(`Bắt đầu cập nhật ${this.current()} → ${tag} (run ${runId})`);
  }

  private record(id: string, to: string, status: string, when: string) {
    return this.ds.query(
      `INSERT INTO update_runs (id, channel, from_version, to_version, status, "when", steps, started_at) VALUES (?,?,?,?,?,?,'[]',?)`,
      [id, this.cfg.updateChannel, this.current(), to, status, when, new Date().toISOString()],
    );
  }
}
