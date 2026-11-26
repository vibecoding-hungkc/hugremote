import { PermissionMode } from '@app/shared';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/ui/Button';
import { Icon } from '../../../components/ui/Icon';
import { toast } from '../../../components/ui/Overlay';
import { useConnection } from '../../../lib/connection';
import type { S } from '../../../types/schemas';

export type CliOptions = S['ClaudeOptionsDto'];
export type Limits = S['ClaudeLimitsDto'];

/** Thứ tự ⇧Tab xoay vòng — Bypass không nằm trong vòng (luôn qua hộp xác nhận, AC-39). */
const CYCLE = [PermissionMode.MANUAL, PermissionMode.ACCEPT_EDITS, PermissionMode.AUTO, PermissionMode.PLAN] as string[];
const ALL_MODES = [...CYCLE, PermissionMode.BYPASS as string];

export interface ComposerProps {
  /** `new` khi chưa tạo phiên. */
  sid: string;
  userId: string;
  running: boolean;
  mode: string;
  model?: string | null;
  effort?: string | null;
  options?: CliOptions;
  optionsError?: boolean;
  context?: { used: number; max: number } | null;
  limits?: Limits;
  hostName: string;
  focus: boolean;
  /** Yêu cầu quyền đang chờ — dải duyệt nhanh trên điện thoại (C36). */
  ask?: { id: string; what: string; isQuestion?: boolean } | null;
  initialAttach?: string[];
  onToggleFocus: () => void;
  onMode: (mode: string) => void;
  onBypass: () => void;
  onModel: (p: { model?: string; effort?: string }) => void;
  onSend: (text: string, attachments: string[]) => Promise<boolean>;
  onStop: () => void;
  onAnswer: (iid: string, d: 'allow' | 'deny') => void;
  onPickAttach: (add: (path: string) => void) => void;
}

const fmtK = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}k` : String(n));
const draftKey = (uid: string, sid: string) => `hugremote:draft:${uid}:${sid}`;
export function clearDraft(uid: string, sid: string) {
  try {
    localStorage.removeItem(draftKey(uid, sid));
  } catch {
    /* chế độ riêng tư */
  }
}
type Draft = { text: string; attach: string[] };
function loadDraft(uid: string, sid: string): Draft {
  try {
    return { text: '', attach: [], ...(JSON.parse(localStorage.getItem(draftKey(uid, sid)) ?? '{}') as Partial<Draft>) };
  } catch {
    return { text: '', attach: [] };
  }
}

type SR = { lang: string; interimResults: boolean; continuous: boolean; start(): void; stop(): void; onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void; onend: () => void };
const SpeechRec = (window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR }).SpeechRecognition ??
  (window as unknown as { webkitSpeechRecognition?: new () => SR }).webkitSpeechRecognition;

/** C36 — Ô soạn Claude: nháp + đính kèm giữ riêng từng phiên trên trình duyệt này (AC-39), `/` gợi ý lệnh, mic, chip Context/Model/Quyền chỉ giá trị (vòng 3 — AC-62), hạn mức trong popup model (AC-63). */
export function Composer(p: ComposerProps) {
  const { t, i18n } = useTranslation();
  const online = useConnection((s) => s.online);
  const [draft, setDraft] = useState<Draft>(() => {
    const d = loadDraft(p.userId, p.sid);
    return p.initialAttach?.length ? { ...d, attach: [...new Set([...d.attach, ...p.initialAttach])] } : d;
  });
  const [menu, setMenu] = useState<'model' | 'mode' | null>(null);
  const [rec, setRec] = useState<SR | null>(null);
  const [sending, setSending] = useState(false);
  const [slashIdx, setSlashIdx] = useState(0);
  const ta = useRef<HTMLTextAreaElement>(null);
  const tools = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      if (draft.text || draft.attach.length) localStorage.setItem(draftKey(p.userId, p.sid), JSON.stringify(draft));
      else localStorage.removeItem(draftKey(p.userId, p.sid));
    } catch {
      /* chế độ riêng tư */
    }
  }, [draft, p.userId, p.sid]);
  // Sang tab Claude bằng phím (⌥1, Ctrl+Tab) → gõ được ngay; chỉ khi có chuột/bàn phím, tránh bật bàn phím ảo trên điện thoại
  useEffect(() => {
    if (matchMedia('(pointer: fine)').matches) ta.current?.focus({ preventScroll: true });
  }, [p.sid]);
  useEffect(() => {
    const el = ta.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [draft.text]);
  useEffect(() => {
    if (!menu) return;
    const off = (e: MouseEvent) => !tools.current?.contains(e.target as Node) && setMenu(null);
    document.addEventListener('mousedown', off);
    // a11y: mở popup → focus mục đang chọn; ↑↓ đi giữa các mục; Esc đóng và trả focus về chip đã mở
    const items = () => [...(tools.current?.querySelectorAll<HTMLElement>('.menu [role=menuitemradio]') ?? [])];
    (items().find((x) => x.getAttribute('aria-checked') === 'true') ?? items()[0])?.focus();
    const key = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setMenu(null);
        tools.current?.querySelector<HTMLElement>(`[data-chip=${menu}]`)?.focus();
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const l = items();
        const i = l.indexOf(document.activeElement as HTMLElement);
        if (i < 0) return;
        e.preventDefault();
        l[(i + (e.key === 'ArrowDown' ? 1 : -1) + l.length) % l.length]?.focus();
      }
    };
    document.addEventListener('keydown', key, true);
    return () => {
      document.removeEventListener('mousedown', off);
      document.removeEventListener('keydown', key, true);
    };
  }, [menu]);
  /** Enter/Space trên mục menu = bấm (div role=menuitemradio không tự có hành vi phím). */
  const pick = (fn: () => void) => ({
    onClick: fn,
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        fn();
      }
    },
  });

  const modeLabel = (m: string) => t(`claude.mode_${m}`, { defaultValue: m });
  const bypass = p.mode === (PermissionMode.BYPASS as string);
  const models = p.options?.models ?? [];
  const curModel = models.find((m) => m.value === (p.model ?? 'default')) ?? models[0];
  const cap = p.context?.max ?? curModel?.contextWindow ?? 200_000;
  const used = p.context?.used ?? 0;
  const effort = p.effort ?? (curModel?.efforts.includes('high') ? 'high' : undefined);
  const slashOn = draft.text.startsWith('/') && !draft.text.includes(' ');
  const slash = slashOn ? (p.options?.commands ?? []).filter((c) => c.name.toLowerCase().startsWith(draft.text.slice(1).toLowerCase())).slice(0, 8) : [];
  // lệnh đang trỏ trong gợi ý `/` — ↑↓ đổi, Enter chọn (dogfood a11y #4)
  const si = Math.min(slashIdx, Math.max(0, slash.length - 1));
  const five = p.limits?.fiveHour;
  const week = p.limits?.weekly;
  const fmtReset = (iso?: string | null) => (iso ? new Date(iso).toLocaleString(i18n.language, { weekday: 'short', hour: '2-digit', minute: '2-digit' }) : '—');

  const send = async () => {
    const text = draft.text.trim();
    if (!text || sending) return;
    if (!online) return toast(t('net.offlineTip'));
    setSending(true);
    try {
      if (await p.onSend(text, draft.attach)) setDraft({ text: '', attach: [] });
    } finally {
      setSending(false);
    }
  };
  const cycle = () => {
    const i = CYCLE.indexOf(p.mode);
    const next = CYCLE[(i + 1) % CYCLE.length];
    p.onMode(next);
    toast(t('claude.modeChanged', { mode: modeLabel(next) }));
  };
  const keys = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (slash.length && (draft.text.length > 1 || si > 0)) return setDraft((d) => ({ ...d, text: `/${slash[si].name} ` }));
      void send();
    } else if (slash.length && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault();
      setSlashIdx((si + (e.key === 'ArrowDown' ? 1 : slash.length - 1)) % slash.length);
    } else if (slash.length && e.key === 'Tab' && !e.shiftKey) {
      // Tab = chọn lệnh đang sáng như CLI (Authority 2026-11-26); chọn xong có dấu cách → danh sách đóng, Tab lại rời ô như thường
      e.preventDefault();
      setDraft((d) => ({ ...d, text: `/${slash[si].name} ` }));
    } else if (e.key === 'Tab' && e.shiftKey) {
      e.preventDefault();
      cycle();
    } else if (e.key === 'Escape' && p.running) {
      e.preventDefault();
      p.onStop();
    }
  };
  const mic = () => {
    if (rec) return rec.stop();
    if (!SpeechRec) return toast(t('claude.micUnsupported'));
    const r = new SpeechRec();
    r.lang = i18n.language.startsWith('vi') ? 'vi-VN' : 'en-US';
    r.interimResults = false;
    r.continuous = false;
    const base = draft.text;
    r.onresult = (e) => {
      const said = Array.from(e.results)
        .map((x) => x[0].transcript)
        .join(' ');
      setDraft((d) => ({ ...d, text: (base ? `${base} ` : '') + said }));
    };
    r.onend = () => setRec(null);
    r.start();
    setRec(r);
  };

  return (
    <div className="composer">
      <div className="in">
        {p.ask && (
          <div className="askbar">
            <span className="dot warn" />
            <span className="grow ell">{p.ask.what}</span>
            {p.ask.isQuestion ? (
              <Button variant="primary" size="sm" onClick={() => document.getElementById(`ask-${p.ask!.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>
                {t('claude.askPick')}
              </Button>
            ) : (
              <Button variant="primary" size="sm" icon="check" write onClick={() => p.onAnswer(p.ask!.id, 'allow')}>
                {t('claude.allow')}
              </Button>
            )}
            <Button size="sm" iconOnly icon="x" write label={t('claude.deny')} onClick={() => p.onAnswer(p.ask!.id, 'deny')} />
          </div>
        )}
        {slash.length > 0 && (
          <div className="slash" role="listbox" id={`slash-${p.sid}`} aria-label={t('claude.slashList')}>
            {slash.map((c, i) => (
              <div
                key={c.name}
                id={`slash-${p.sid}-${i}`}
                className={`mi ${i === si ? 'on' : ''}`}
                aria-selected={i === si}
                role="option"
                tabIndex={-1}
                onMouseDown={(e) => {
                  e.preventDefault();
                  setDraft((d) => ({ ...d, text: `/${c.name} ` }));
                  ta.current?.focus();
                }}
              >
                <b>/{c.name}</b>
                <span className="muted">{c.description}</span>
              </div>
            ))}
          </div>
        )}
        <div className="cbox">
          {draft.attach.length > 0 && (
            <div className="btns">
              {draft.attach.map((a) => (
                <span className="attach" key={a} title={a}>
                  <Icon name="file" />
                  {a.split('/').filter(Boolean).pop()}
                  <Button
                    variant="ghost"
                    size="sm"
                    iconOnly
                    icon="x"
                    label={t('claude.unattach', { name: a })}
                    onClick={() => setDraft((d) => ({ ...d, attach: d.attach.filter((x) => x !== a) }))}
                  />
                </span>
              ))}
            </div>
          )}
          <div className="crow">
            <textarea
              ref={ta}
              id={`prompt-${p.sid}`}
              rows={1}
              aria-label={t('claude.promptLabel')}
              placeholder={rec ? t('claude.listening') : p.running ? t('claude.placeholderQueue') : t('claude.placeholder')}
              value={draft.text}
              onChange={(e) => (setSlashIdx(0), setDraft((d) => ({ ...d, text: e.target.value })))}
              aria-controls={slash.length ? `slash-${p.sid}` : undefined}
              aria-expanded={slash.length > 0}
              aria-activedescendant={slash.length ? `slash-${p.sid}-${si}` : undefined}
              onKeyDown={keys}
            />
            {SpeechRec && <Button variant="ghost" size="sm" iconOnly icon="mic" tone={rec ? 'primary' : undefined} label={rec ? t('claude.micStop') : t('claude.mic')} onClick={mic} />}
          </div>
          <div className="crow tools" ref={tools}>
            {menu === 'model' && (
              <div className="menu inline" role="menu">
                {p.optionsError && <div className="grp">{t('claude.modelProbeFailed')}</div>}
                {(five || week) && (
                  <div className="mi static" style={{ gap: 'var(--space-sm)' }}>
                    {[
                      ...(five ? [[t('claude.limit5hFull'), five.pct, five.resetAt] as const] : []),
                      ...(week ? [[t('claude.limitWeekFull'), week.pct, week.resetAt] as const] : []),
                    ].map(([label, pct, reset]) => (
                      <div key={String(label)} style={{ display: 'grid', gap: 'var(--space-xs)' }}>
                        <div className="xs" style={{ display: 'flex' }}>
                          <span className="grow">{label}</span>
                          <b className="mono">{pct}%</b>
                          <span className="muted">&nbsp;· {t('claude.resetAt', { at: fmtReset(reset as string | undefined) })}</span>
                        </div>
                        <div className={`prog ${Number(pct) >= 80 ? 'warn' : ''}`} role="progressbar" aria-label={String(label)} aria-valuenow={Number(pct)} aria-valuemin={0} aria-valuemax={100}>
                          <i style={{ width: `${Math.min(100, Number(pct))}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {!five && !week && (
                  // CLI chỉ báo hạn mức kèm một lượt chat → chưa có lượt nào trên máy này thì nói rõ, không ẩn im lặng
                  <div className="mi static" style={{ maxWidth: 320 }}>
                    <span className="d">{t('claude.limitsUnknown')}</span>
                  </div>
                )}
                {models.map((m) => (
                  <div
                    key={m.value}
                    className={`mi ${curModel?.value === m.value ? 'on' : ''}`}
                    role="menuitemradio"
                    aria-checked={curModel?.value === m.value}
                    tabIndex={0}
                    {...pick(() => {
                      p.onModel({ model: m.value });
                      setMenu(null);
                    })}
                  >
                    <b>{m.displayName}</b>
                    <span className="d">
                      {m.description} · {t('claude.modelFrom', { host: p.hostName })}
                    </span>
                  </div>
                ))}
                {curModel && curModel.efforts.length > 0 && (
                  <div className="mi" style={{ cursor: 'default' }}>
                    <span className="d">{t('claude.effort')}</span>
                    <div className="seg">
                      {curModel.efforts.map((e) => (
                        <button
                          key={e}
                          aria-pressed={effort === e}
                          className={effort === e ? 'on' : ''}
                          onClick={() => {
                            p.onModel({ effort: e });
                            setMenu(null);
                          }}
                        >
                          {t(`claude.effort_${e}`, { defaultValue: e })}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            {menu === 'mode' && (
              <div className="menu inline" role="menu">
                <div className="grp">{t('claude.modeGroup')}</div>
                {ALL_MODES.map((m) => {
                  const isBy = m === (PermissionMode.BYPASS as string);
                  return (
                    <div
                      key={m}
                      className={`mi ${p.mode === m ? 'on' : ''} ${isBy ? 'danger' : ''}`}
                      role="menuitemradio"
                      aria-checked={p.mode === m}
                      tabIndex={0}
                      {...pick(() => {
                        setMenu(null);
                        if (isBy) p.onBypass();
                        else p.onMode(m);
                      })}
                    >
                      <b>
                        {isBy && <Icon name="warn" />}
                        {modeLabel(m)} <span className="muted xs">{m}</span>
                      </b>
                      <span className="d">{t(`claude.mode_${m}_d`)}</span>
                    </div>
                  );
                })}
              </div>
            )}
            <Button variant="ghost" size="sm" iconOnly icon="clip" label={t('claude.attach')} onClick={() => p.onPickAttach((path) => setDraft((d) => ({ ...d, attach: [...new Set([...d.attach, path])] })))} />
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              icon="target"
              tone={p.focus ? 'primary' : undefined}
              label={p.focus ? t('claude.focusOn') : t('claude.focusOff')}
              aria-pressed={p.focus}
              onClick={p.onToggleFocus}
            />
            <span className="cscroll">
              <span className={`chip ${used / cap > 0.8 ? 'warn' : ''}`} title={`${t('claude.context')} — ${t('claude.contextTip')}`} aria-label={t('claude.context')}>
                <b className="mono">
                  {fmtK(used)}/{fmtK(cap)}
                </b>
              </span>
              <button
                className="chip"
                data-chip="model"
                aria-haspopup="menu"
                aria-expanded={menu === 'model'}
                title={`${t('claude.model')} — ${t('claude.modelTip')}`}
                aria-label={`${t('claude.model')}: ${(curModel?.displayName ?? p.model ?? '…').replace(/\s*\(recommended\)/i, '')}${effort ? ` · ${t(`claude.effort_${effort}`, { defaultValue: effort })}` : ''}`}
                onClick={() => setMenu(menu === 'model' ? null : 'model')}
              >
                <b>
                  {(curModel?.displayName ?? p.model ?? '…').replace(/\s*\(recommended\)/i, '')}
                  {effort ? ` · ${t(`claude.effort_${effort}`, { defaultValue: effort })}` : ''}
                </b>{' '}
                ▾
              </button>
              <button
                className={`chip ${bypass ? 'danger' : ''}`}
                data-chip="mode"
                aria-haspopup="menu"
                aria-expanded={menu === 'mode'}
                title={`${t('claude.mode')} — ${t('claude.modeTip', { desc: t(`claude.mode_${p.mode}_d`) })}`}
                aria-label={`${t('claude.mode')}: ${modeLabel(p.mode)}`}
                onClick={() => setMenu(menu === 'mode' ? null : 'mode')}
              >
                <Icon name={bypass ? 'warn' : p.mode === (PermissionMode.PLAN as string) ? 'list' : 'bolt'} />
                <b>{modeLabel(p.mode)}</b> ▾
              </button>
            </span>
            {p.running && <Button variant="danger" size="sm" iconOnly icon="stop" write label={t('claude.stop')} onClick={p.onStop} />}
            <Button variant="primary" size="sm" iconOnly icon="up" write loading={sending} label={p.running ? t('claude.sendQueue') : t('claude.send')} onClick={() => void send()} />
          </div>
        </div>
      </div>
    </div>
  );
}
