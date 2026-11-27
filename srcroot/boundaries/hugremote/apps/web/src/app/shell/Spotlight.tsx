import { foldVietnamese } from '@app/shared';
import { useQuery } from '@tanstack/react-query';
import { Fragment, useMemo, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Icon, type IconName } from '../../components/ui/Icon';
import { StatusBadge, type Status } from '../../components/ui/Status';
import { filesApi } from '../../features/files/api/files.api';
import { useHosts, usePins, useProjectsOf } from '../../features/workspace/hooks/useWorkspace';
import { useUi } from '../../stores/ui.store';
import { useNewSession } from './actions';
import { pbase, sessionIcon, useSessions } from './sessions';

interface Item {
  g: string;
  icon: IconName;
  cls?: string;
  t: string;
  s: string;
  st?: Status;
  run: () => void;
}

const norm = (s: string) => foldVietnamese(s.toLowerCase());

/**
 * S11 — Chuyển nhanh (⌘K): dự án, phiên, file của dự án hiện tại, lệnh — gõ không dấu cũng khớp.
 * Trống → các phiên đang chạy / cần duyệt (tới đúng chỗ trong ≤3 thao tác, AC-26).
 */
export function Spotlight({ hostId, projectId, onClose }: { hostId?: string; projectId?: string; onClose: () => void }) {
  const { t } = useTranslation();
  const nav = useNavigate();
  const setUi = useUi((s) => s.set);
  const newSession = useNewSession();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const hosts = useHosts().data?.hosts ?? [];
  const pins = usePins().data ?? [];
  const pinned = hosts.filter((h) => pins.includes(h.id));
  const projects = useProjectsOf(pinned.map((h) => h.id));
  const sessions = useSessions().all;
  const files = useQuery({ queryKey: ['fsfiles', projectId], queryFn: () => filesApi.files(projectId!), enabled: !!projectId, staleTime: 30_000 });

  const items = useMemo(() => {
    const out: Item[] = [];
    pinned.forEach((h, i) => {
      for (const p of projects[i]?.data ?? []) {
        out.push({ g: h.name, icon: 'folder', t: p.name, s: `${h.name} · ${p.rootPath}`, run: () => nav(`${pbase(h.id, p.id)}/sessions`) });
        for (const s of sessions.filter((x) => x.projectId === p.id))
          out.push({
            g: h.name,
            icon: sessionIcon(s).name,
            cls: sessionIcon(s).cls,
            t: s.name,
            s: `${s.kind === 'claude' ? 'Claude' : s.kind === 'web' ? t('web.group') : 'Terminal'} · ${p.name}${s.note ? ` · 📝 ${s.note.text}` : ''}`,
            st: s.status,
            run: () => nav(`${pbase(h.id, p.id)}/${s.kind}/${s.id}`),
          });
      }
    });
    if (hostId && projectId)
      for (const f of files.data?.files ?? [])
        out.push({ g: t('spot.files'), icon: 'file', t: f.split('/').pop()!, s: f, run: () => nav(`${pbase(hostId, projectId)}/files/${f.split('/').map(encodeURIComponent).join('/')}`) });
    const here = hostId && projectId;
    const cmds: [string, string, () => void, boolean][] = [
      [t('spot.cmdGit'), t('spot.cmdGitD'), () => nav(`${pbase(hostId!, projectId!)}/git`), !!here],
      [t('spot.cmdFiles'), t('spot.cmdFilesD'), () => nav(`${pbase(hostId!, projectId!)}/files`), !!here],
      [t('spot.cmdTerm'), t('spot.cmdTermD'), () => void newSession('terminal', hostId!, projectId!), !!here],
      [t('spot.cmdClaude'), t('spot.cmdClaudeD'), () => void newSession('claude', hostId!, projectId!), !!here],
      [t('spot.cmdSettings'), t('spot.cmdSettingsD'), () => nav('/settings'), true],
      [t('spot.cmdHosts'), t('spot.cmdHostsD'), () => nav('/hosts'), true],
      [t('spot.cmdKeys'), t('spot.cmdKeysD'), () => setUi({ keys: true }), true],
    ];
    for (const [title, desc, run, ok] of cmds) if (ok) out.push({ g: t('spot.commands'), icon: 'chev', t: title, s: desc, run });
    return out;
  }, [pinned, projects, sessions, files.data, hostId, projectId, t, nav, newSession, setUi]);

  const res = useMemo(() => {
    const toks = norm(q).split(/\s+/).filter(Boolean);
    // ô trống: MỌI phiên (Authority 2026-11-27 — trước chỉ phiên cần bạn + đang chạy), cần bạn → đang chạy → còn lại
    const rank = (i: Item) => (i.st === 'awaiting' ? 0 : i.st === 'running' ? 1 : 2);
    if (!toks.length) return items.filter((i) => i.st).sort((a, b) => rank(a) - rank(b));
    const hit = items.filter((i) => toks.every((k) => norm(`${i.t} ${i.s}`).includes(k)));
    // khớp ở tên xếp trước khớp ở mô tả; file chỉ giữ 20 cái đầu cho gọn
    hit.sort((a, b) => Number(toks.every((k) => norm(b.t).includes(k))) - Number(toks.every((k) => norm(a.t).includes(k))));
    let nFiles = 0;
    return hit.filter((i) => i.icon !== 'file' || ++nFiles <= 20).slice(0, 60);
  }, [items, q]);
  const groups = [...new Set(res.map((i) => i.g))];
  const ordered = groups.flatMap((g) => res.filter((i) => i.g === g));

  const go = (i: Item) => {
    onClose();
    i.run();
  };
  const keys = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setSel((x) => (ordered.length ? (x + (e.key === 'ArrowDown' ? 1 : -1) + ordered.length) % ordered.length : 0));
    } else if (e.key === 'Enter' && !e.nativeEvent.isComposing && ordered[sel]) {
      e.preventDefault();
      go(ordered[sel]);
    } else if (e.key === 'Escape') onClose();
  };

  return createPortal(
    <div className="scrim" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <section className="spot" role="dialog" aria-label={t('spot.title')} data-screen="S11">
        <div className="top">
          <input
            autoFocus
            value={q}
            placeholder={t('spot.placeholder')}
            aria-label={t('spot.title')}
            autoComplete="off"
            onChange={(e) => {
              setQ(e.target.value);
              setSel(0);
            }}
            onKeyDown={keys}
          />
          <Button variant="ghost" size="sm" iconOnly icon="x" label={t('common.close')} onClick={onClose} />
        </div>
        <div className="res" role="listbox">
          {ordered.length ? (
            groups.map((g) => (
              <Fragment key={g}>
                <div className="grp">{g}</div>
                {ordered
                  .map((i, n) => [i, n] as const)
                  .filter(([i]) => i.g === g)
                  .map(([i, n]) => (
                    <div
                      key={`${n}-${i.t}`}
                      className={`row ${n === sel ? 'sel' : ''}`}
                      role="option"
                      aria-selected={n === sel}
                      tabIndex={-1}
                      onMouseEnter={() => setSel(n)}
                      onClick={() => go(i)}
                    >
                      <Icon name={i.icon} className={i.cls} />
                      <div className="t">
                        <div className="t1 sm">{i.t}</div>
                        <div className="t2 xs">{i.s}</div>
                      </div>
                      {i.st && <StatusBadge status={i.st} />}
                    </div>
                  ))}
              </Fragment>
            ))
          ) : (
            <div className="empty">
              <p>{q ? t('spot.none', { q }) : t('spot.idle')}</p>
            </div>
          )}
        </div>
      </section>
    </div>,
    document.body,
  );
}

const IS_PWA = typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches;
/** Trong tab trình duyệt, phím trình duyệt giữ (⌘W, ⌘1–9, ⌘⇧N…) đổi sang ⌥; chạy dạng PWA dùng phím gốc. */
export const ALT_KEY = IS_PWA ? '⌘' : '⌥';

/** Bảng phím tắt (⌘/). */
export function KeysDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const A = ALT_KEY;
  const rows: [string, string][] = [
    ['⌘K / Ctrl+Alt+K', t('keys.spot')],
    ['⌘P', t('keys.quick')],
    ['⌘⇧F', t('keys.search')],
    ['⌘F · Ctrl+G', t('keys.find')],
    ['⌘S', t('keys.save')],
    [`${A}W`, t('keys.close')],
    [`${A}1…${A}9`, t('keys.nth')],
    ['Ctrl+Tab', t('keys.next')],
    ['Ctrl+1 · 2 · 3', t('keys.tabs')],
    [`${A}⇧N · ${A}⇧T · ${A}⇧M`, t('keys.newSession')],
    ['⌘\\', t('keys.side')],
    ['Enter · ⇧Enter', t('keys.send')],
    ['⇧Tab', t('keys.mode')],
    ['Esc', t('keys.esc')],
    [`${A}Y · ${A}N`, t('keys.answer')],
    ['⌘Enter', t('keys.commit')],
    [t('keys.spaceKey'), t('keys.stage')],
    ['⌘/', t('keys.table')],
    ['⌥← · ⌥→', t('keys.termWord')],
    ['⌘← · ⌘→', t('keys.termLine')],
    ['⌥⌫ · ⌘⌫', t('keys.termDel')],
    ['⇧Enter', t('keys.termNewline')],
    ['⌘C · ⌘V', t('keys.termCopy')],
    ['⌥ + drag', t('keys.termSelect')],
  ];
  return createPortal(
    <div className="scrim" onClick={(e) => e.target === e.currentTarget && onClose()} onKeyDown={(e) => e.key === 'Escape' && onClose()}>
      <section className="dialog" role="dialog" aria-label={t('keys.title')}>
        <h2>{t('keys.title')}</h2>
        <div className="keytbl">
          {rows.map(([k, v]) => (
            <Fragment key={k}>
              <kbd>{k}</kbd>
              <span>{v}</span>
            </Fragment>
          ))}
        </div>
        <p className="xs">{IS_PWA ? t('keys.pwa') : t('keys.browser')}</p>
        <div className="btns" style={{ justifyContent: 'flex-end' }}>
          <Button autoFocus onClick={onClose}>
            {t('common.close')}
          </Button>
        </div>
      </section>
    </div>,
    document.body,
  );
}
