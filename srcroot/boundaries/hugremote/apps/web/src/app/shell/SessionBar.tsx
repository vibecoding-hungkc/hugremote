import { useQueryClient } from '@tanstack/react-query';
import { useState, type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog, RenameDialog, useDialogs } from '../../components/ui/Dialogs';
import { Icon } from '../../components/ui/Icon';
import { Menu, type MenuItem } from '../../components/ui/Overlay';
import { StatusDot } from '../../components/ui/Status';
import { claudeApi } from '../../features/claude/api/claude.api';
import { ck } from '../../features/claude/hooks/useClaude';
import { workspaceApi } from '../../features/workspace/api/workspace.api';
import { qk } from '../../features/workspace/hooks/useWorkspace';
import { useUi } from '../../stores/ui.store';
import { useNewSession } from './actions';
import { NotifBell } from './NotifBell';
import { pbase, useSessions, type SessionItem } from './sessions';

/** C8 thanh phiên (tab trộn Claude trước, terminal sau) + C32 bộ chọn phiên trên mobile. Dùng chung S6/S10. */
export function SessionBar({ hostId, projectId, currentId }: { hostId: string; projectId: string; currentId?: string }) {
  const { t } = useTranslation();
  const nav = useNavigate();
  const qc = useQueryClient();
  const list = useSessions().byProject.get(projectId) ?? [];
  const cur = list.find((s) => s.id === currentId);
  const newSession = useNewSession();
  const openDialog = useDialogs((s) => s.open);
  const [menu, setMenu] = useState<{ rect: DOMRect; items: MenuItem[] } | null>(null);
  const base = pbase(hostId, projectId);
  const split = useUi((s) => s.split);
  const setUi = useUi((s) => s.set);
  const pop = (e: MouseEvent<HTMLElement>, items: MenuItem[]) => setMenu({ rect: e.currentTarget.getBoundingClientRect(), items });
  const close = (s: SessionItem) => {
    const run = async () => {
      if (s.kind === 'terminal') await workspaceApi.closeTerminal(s.id);
      else await claudeApi.remove(s.id);
      await qc.invalidateQueries({ queryKey: s.kind === 'terminal' ? qk.terminals : ck.sessions });
      if (s.id === currentId) {
        const next = list.find((x) => x.id !== s.id);
        nav(next ? `${base}/${next.kind}/${next.id}` : `${base}/sessions`);
      }
    };
    if (s.status !== 'running' && s.status !== 'awaiting') return void run();
    openDialog(<ConfirmDialog danger title={t('session.closeTitle', { name: s.name })} body={<p>{t('session.closeBody')}</p>} confirmLabel={t('session.close')} onConfirm={run} />);
  };
  const plus = (e: MouseEvent<HTMLElement>) =>
    pop(e, [
      { icon: 'claude', label: t('session.newClaude'), kbd: '⌥⇧N', onSelect: () => void newSession('claude', hostId, projectId) },
      { icon: 'term', label: t('session.newTerminal'), kbd: '⌥⇧T', onSelect: () => void newSession('terminal', hostId, projectId) },
    ]);
  const picker = (e: MouseEvent<HTMLElement>) =>
    pop(
      e,
      list.map((s, i) => ({
        group: s.kind === 'claude' ? 'Claude' : 'Terminal',
        icon: s.kind === 'claude' ? ('claude' as const) : ('term' as const),
        label: (
          <>
            {s.name} <span className="muted xs">· {t(`status.${s.status}`)}</span>
          </>
        ),
        kbd: i < 9 ? `⌥${i + 1}` : undefined,
        onSelect: () => nav(`${base}/${s.kind}/${s.id}`),
      })),
    );
  return (
    <div className="tabbar">
      <div className="tabs" role="tablist">
        {list.map((s, i) => (
          <div
            key={s.id}
            className={`tab ${s.id === currentId ? 'on' : ''} ${s.status === 'exited' ? 'ended' : ''}`}
            role="tab"
            aria-selected={s.id === currentId}
            tabIndex={0}
            title={`${s.name}${i < 9 ? ` (⌥${i + 1})` : ''}`}
            onClick={() => nav(`${base}/${s.kind}/${s.id}`)}
            onKeyDown={(e) => e.key === 'Enter' && nav(`${base}/${s.kind}/${s.id}`)}
          >
            <Icon name={s.kind === 'claude' ? 'claude' : 'term'} className={s.kind === 'claude' ? 'claude-ic' : 'term-ic'} />
            <span className="tn">{s.name}</span>
            {s.bypass && <Icon name="warn" className="warn-ic" />}
            <StatusDot status={s.status} />
            {s.kind === 'terminal' ? (
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              icon="x"
              label={`${t('session.close')} ${s.name} (⌥W)`}
              onClick={(e) => {
                e.stopPropagation();
                close(s);
              }}
            />
            ) : (
              <span style={{ width: 'var(--space-xs)' }} />
            )}
          </div>
        ))}
      </div>
      <button className="sesspick" onClick={picker}>
        {cur && <Icon name={cur.kind === 'claude' ? 'claude' : 'term'} className={cur.kind === 'claude' ? 'claude-ic' : 'term-ic'} />}
        <span className="ell grow" style={{ textAlign: 'left' }}>
          {cur ? cur.name : t('session.pick')}
        </span>
        {cur && <StatusDot status={cur.status} />}
        <span className="badge">{t('session.count', { count: list.length })}</span>
        <Icon name="chevd" />
      </button>
      <div className="tools">
        <NotifBell hostId={hostId} projectId={projectId} />
        {cur && (
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            icon="edit"
            label={t('tree.renameSession')}
            onClick={() =>
              openDialog(
                <RenameDialog
                  title={t('tree.renameSession')}
                  initial={cur.name}
                  onSave={async (name) => {
                    if (cur.kind === 'terminal') await workspaceApi.renameTerminal(cur.id, name);
                    else await claudeApi.patch(cur.id, { name });
                    await qc.invalidateQueries({ queryKey: cur.kind === 'terminal' ? qk.terminals : ck.sessions });
                  }}
                />,
              )
            }
          />
        )}
        {cur && (
          <span className="hide-mobile">
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              icon="split"
              tone={split ? 'primary' : undefined}
              label={split ? t('split.change') : t('split.open')}
              onClick={(e) =>
                pop(e, [
                  ...(['claude', 'terminal', 'files', 'git'] as const).map((k) => ({
                    icon: (k === 'terminal' ? 'term' : k === 'files' ? 'file' : k) as 'claude' | 'term' | 'file' | 'git',
                    label: t('split.right', { what: t(`split.k_${k}`) }),
                    onSelect: () => setUi({ split: { kind: k } }),
                  })),
                  ...(split ? [{ icon: 'x' as const, label: t('split.close'), onSelect: () => setUi({ split: null }) }] : []),
                ])
              }
            />
          </span>
        )}
        <Button variant="ghost" size="sm" iconOnly icon="plus" label={t('tree.newSession')} onClick={plus} />
      </div>
      {menu && <Menu anchor={menu.rect} items={menu.items} onClose={() => setMenu(null)} />}
    </div>
  );
}
