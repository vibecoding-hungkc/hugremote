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
  ask?: { id: string; what: string } | null;
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

/** C36 — Ô soạn Claude: nháp + đính kèm giữ riêng từng phiên trên trình duyệt này (AC-39), `/` gợi ý lệnh, mic, chip Context/Hạn mức/Model/Quyền. */
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
    return () => document.removeEventListener('mousedown', off);
  }, [menu]);

  const modeLabel = (m: string) => t(`claude.mode_${m}`, { defaultValue: m });
  const bypass = p.mode === (PermissionMode.BYPASS as string);
  const models = p.options?.models ?? [];
  const curModel = models.find((m) => m.value === (p.model ?? 'default')) ?? models[0];
  const cap = p.context?.max ?? curModel?.contextWindow ?? 200_000;
  const used = p.context?.used ?? 0;
  const effort = p.effort ?? (curModel?.efforts.includes('high') ? 'high' : undefined);
  const slashOn = draft.text.startsWith('/') && !draft.text.includes(' ');
  const slash = slashOn ? (p.options?.commands ?? []).filter((c) => c.name.toLowerCase().startsWith(draft.text.slice(1).toLowerCase())).slice(0, 8) : [];
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
      if (slash.length && draft.text.length > 1) return setDraft((d) => ({ ...d, text: `/${slash[0].name} ` }));
      void send();
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
            <Button variant="primary" size="sm" icon="check" write onClick={() => p.onAnswer(p.ask!.id, 'allow')}>
              {t('claude.allow')}
            </Button>
            <Button size="sm" iconOnly icon="x" write label={t('claude.deny')} onClick={() => p.onAnswer(p.ask!.id, 'deny')} />
          </div>
        )}
        {slash.length > 0 && (
          <div className="slash" role="listbox">
            {slash.map((c) => (
              <div
                key={c.name}
                className="mi"
                role="option"
                tabIndex={-1}
                onMouseDown={(e) => {
                  e.preventDefault();
                  setDraft((d) => ({ ...d, text: `/${c.name} ` }));
                  ta.current?.focus();
                }}
              >
                <b>/{c.name}</b>
                <span className="muted ell">{c.description}</span>
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
              onChange={(e) => setDraft((d) => ({ ...d, text: e.target.value }))}
              onKeyDown={keys}
            />
            {SpeechRec && <Button variant="ghost" size="sm" iconOnly icon="mic" tone={rec ? 'primary' : undefined} label={rec ? t('claude.micStop') : t('claude.mic')} onClick={mic} />}
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              icon={bypass ? 'warn' : 'shield'}
              tone={bypass ? 'danger' : undefined}
              label={t('claude.modeIconTip', { mode: modeLabel(p.mode) })}
              onClick={() => setMenu(menu === 'mode' ? null : 'mode')}
            />
          </div>
          <div className="crow tools" ref={tools}>
            {menu === 'model' && (
              <div className="menu inline" role="menu">
                {p.optionsError && <div className="grp">{t('claude.modelProbeFailed')}</div>}
                {models.map((m) => (
                  <div
                    key={m.value}
                    className={`mi ${curModel?.value === m.value ? 'on' : ''}`}
                    role="menuitemradio"
                    aria-checked={curModel?.value === m.value}
                    tabIndex={0}
                    onClick={() => {
                      p.onModel({ model: m.value });
                      setMenu(null);
                    }}
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
                      onClick={() => {
                        setMenu(null);
                        if (isBy) p.onBypass();
                        else p.onMode(m);
                      }}
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
              <span className={`chip ${used / cap > 0.8 ? 'warn' : ''}`} title={t('claude.contextTip')}>
                {t('claude.context')}{' '}
                <b className="mono">
                  {fmtK(used)}/{fmtK(cap)}
                </b>
              </span>
              {five && (
                <span
                  className={`chip ${five.pct >= 80 ? 'warn' : ''}`}
                  title={t('claude.limitTip', { p5: five.pct, r5: fmtReset(five.resetAt), pw: week?.pct ?? '—', rw: fmtReset(week?.resetAt) })}
                >
                  {t('claude.limit5h')} <b>{five.pct}%</b>
                  {week && (
                    <span className="hide-mobile">
                      {' '}
                      · {t('claude.limitWeek')} <b>{week.pct}%</b>
                    </span>
                  )}
                </span>
              )}
              <button className="chip" title={t('claude.modelTip')} onClick={() => setMenu(menu === 'model' ? null : 'model')}>
                {t('claude.model')}{' '}
                <b>
                  {curModel?.displayName ?? p.model ?? '…'}
                  {effort ? ` · ${t(`claude.effort_${effort}`, { defaultValue: effort })}` : ''}
                </b>{' '}
                ▾
              </button>
              <button
                style={{ marginLeft: 'auto' }}
                className={`chip ${bypass ? 'danger' : ''}`}
                title={t('claude.modeTip', { desc: t(`claude.mode_${p.mode}_d`) })}
                onClick={() => setMenu(menu === 'mode' ? null : 'mode')}
              >
                <Icon name={bypass ? 'warn' : p.mode === (PermissionMode.PLAN as string) ? 'list' : 'bolt'} />
                {t('claude.mode')} <b>{modeLabel(p.mode)}</b> ▾
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
