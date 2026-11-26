import { useQueryClient } from '@tanstack/react-query';
import { Fragment, useState, type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog, RenameDialog, useDialogs } from '../../components/ui/Dialogs';
import { Menu, toast, type MenuItem } from '../../components/ui/Overlay';
import { Icon } from '../../components/ui/Icon';
import { TreeNode } from '../../components/ui/TreeNode';
import { useMe } from '../../features/auth/hooks/useMe';
import { workspaceApi } from '../../features/workspace/api/workspace.api';
import { qk, useHosts, usePins, useProjectsOf, useSetPins } from '../../features/workspace/hooks/useWorkspace';
import { useUi } from '../../stores/ui.store';
import type { Project } from '../../types/schemas';
import { NoteDialog } from '../../features/notes/NoteBar';
import { useLostTerms } from '../../features/terminal/lost';
import { useConnection } from '../../lib/connection';
import { closeNeedsConfirm, closeSessionApi, openProject, renameSessionApi, useNewSession, usePlusMenu, type MenuState } from './actions';
import { pbase, sessionHref, sessionIcon, shortAgo, useSessions, type SessionItem } from './sessions';


/** C11 cây Máy → Dự án → Phiên. Chỉ mở thứ đang dùng (Authority lượt 2); đầu cây có Thu gọn tất cả + ghim thêm máy. */
export function WorkspaceTree() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const qc = useQueryClient();
  const params = useParams();
  const me = useMe();
  const owner = me.data?.role === 'owner';
  const hosts = useHosts();
  const pins = usePins();
  const setPins = useSetPins();
  const ui = useUi();
  const sessions = useSessions();
  const newSession = useNewSession();
  const plusMenu = usePlusMenu();
  const openDialog = useDialogs((s) => s.open);
  const [menu, setMenu] = useState<MenuState>(null);

  const pinned = (pins.data ?? []).map((id) => hosts.data?.hosts.find((h) => h.id === id)).filter((h): h is NonNullable<typeof h> => !!h);
  const projectQs = useProjectsOf(pinned.map((h) => h.id));
  const curHost = params.hostId;
  const curProject = params.projectId;
  const curSid = params.sid;

  const pop = (e: MouseEvent<HTMLElement>, items: MenuItem[]) => setMenu({ rect: e.currentTarget.getBoundingClientRect(), items });

  // Một nút ⋯ cho dòng dự án: phiên mới (+ tmux có sẵn) ở trên, thao tác dự án ở nhóm dưới (Authority 2026-11-25)
  const projectItems = (hostId: string, p: Project): MenuItem[] =>
    (owner
      ? [
          {
            icon: 'edit' as const,
            label: t('tree.renameProject'),
            onSelect: () =>
              openDialog(
                <RenameDialog
                  title={t('tree.renameProject')}
                  initial={p.name}
                  onSave={async (name) => {
                    await workspaceApi.renameProject(p.id, name);
                    await qc.invalidateQueries({ queryKey: qk.projects(hostId) });
                    toast(t('tree.renamed'));
                  }}
                />,
              ),
          },
          ...(!p.isHome
            ? [
                {
                  icon: 'trash' as const,
                  label: t('tree.removeProject'),
                  danger: true,
                  onSelect: async () => {
                    const { sessions: n } = await workspaceApi.removePreview(p.id);
                    openDialog(
                      <ConfirmDialog
                        danger
                        title={t('tree.removeProjectTitle', { name: p.name })}
                        body={<p>{t('tree.removeProjectBody', { count: n })}</p>}
                        confirmLabel={t('tree.removeProjectConfirm')}
                        onConfirm={async () => {
                          await workspaceApi.removeProject(p.id);
                          await qc.invalidateQueries({ queryKey: qk.projects(hostId) });
                          await qc.invalidateQueries({ queryKey: qk.terminals });
                          if (curProject === p.id) nav('/');
                          toast(t('tree.removed', { name: p.name }));
                        }}
                      />,
                    );
                  },
                },
              ]
            : []),
        ]
      : []) as MenuItem[];

  const sessionItems = (s: SessionItem): MenuItem[] => [
    {
      icon: 'note',
      label: s.note ? t('note.editMenu') : t('note.addMenu'),
      kbd: '⌥⇧K',
      onSelect: () => openDialog(<NoteDialog sessionId={s.id} name={s.name} initial={s.note?.text ?? ''} />),
    },
    {
      icon: 'edit',
      label: t('tree.renameSession'),
      onSelect: () =>
        openDialog(
          <RenameDialog
            title={t('tree.renameSession')}
            initial={s.name}
            onSave={async (name) => {
              await renameSessionApi(qc, s, name);
            }}
          />,
        ),
    },
    {
      icon: 'x',
      label: t('session.close'),
      danger: true,
      kbd: '⌥W',
      onSelect: () => closeSession(s),
    },
  ];

  const closeSession = (s: SessionItem) => {
    const run = async () => {
      await closeSessionApi(qc, s);
      if (curSid === s.id) nav(curHost && curProject ? `${pbase(curHost, curProject)}/sessions` : '/');
    };
    if (!closeNeedsConfirm(s)) return void run();
    openDialog(<ConfirmDialog danger title={t('session.closeTitle', { name: s.name })} body={<p>{t(s.kind === 'claude' ? 'session.closeBodyClaude' : 'session.closeBody')}</p>} confirmLabel={t('session.close')} onConfirm={run} />);
  };

  const hostItems = (hostId: string): MenuItem[] => [
    ...(owner ? [{ icon: 'plus' as const, label: hostId === 'local' ? t('tree.newProject') : t('tree.newProjectOn', { host: hostId }), onSelect: () => nav(`/s/${encodeURIComponent(hostId)}/new-project`) }] : []),
    ...(owner && hostId !== 'local' ? [{ icon: 'edit' as const, label: t('tree.editHost'), onSelect: () => nav(`/hosts?edit=${encodeURIComponent(hostId)}`) }] : []),
    ...(owner && hostId !== 'local' ? [{ icon: 'fwd' as const, label: t('fw.ofHost'), onSelect: () => nav(`/ports?host=${encodeURIComponent(hostId)}`) }] : []),
    { icon: 'unpin', label: t('tree.unpin'), danger: true, onSelect: () => setPins.mutate((pins.data ?? []).filter((x) => x !== hostId)) },
  ];

  const online = useConnection((s) => s.online);
  const lostIds = useLostTerms((s) => s.ids);
  return (
    <>
      <div className="tree-head">
        <span className="grow">{t('tree.title')}</span>
        <Button variant="ghost" size="sm" iconOnly icon="collapse" label={t('tree.collapseAll')} onClick={() => ui.collapseAll()} />
        <Button variant="ghost" size="sm" iconOnly icon="plus" label={t('tree.pinMore')} onClick={() => nav('/hosts')} />
      </div>
      <nav className="tree" role="tree" aria-label={t('tree.title')}>
        {pinned.map((h, hi) => {
          // máy/dự án đang dùng luôn mở; còn lại theo lựa chọn người dùng
          const hOpen = ui.open[h.id] ?? h.id === curHost;
          const projects = projectQs[hi]?.data ?? [];
          const hostSessions = projects.flatMap((p) => sessions.byProject.get(p.id) ?? []);
          const need = hostSessions.filter((s) => s.status === 'awaiting').length;
          const run = hostSessions.filter((s) => s.status === 'running').length;
          // đỏ khi: HugRemote mất kết nối · lần nối SSH gần nhất hỏng/rớt · có terminal của máy đang nối lại (Authority 2026-11-26)
          const down = !online || h.conn === 'err' || hostSessions.some((s) => lostIds[s.id]);
          return (
            <div key={h.id}>
              <TreeNode
                level={0}
                icon={h.kind === 'local' ? 'home' : 'server'}
                name={h.kind === 'local' ? t('hosts.thisMachineShort') : h.name}
                expanded={hOpen}
                onToggle={() => ui.toggle(h.id, !hOpen)}
                onClick={() => ui.toggle(h.id, !hOpen)}
                count={!hOpen ? need : 0}
                meta={!hOpen && run ? t('tree.running', { count: run }) : undefined}
                status={!h.trusted ? 'connecting' : down ? 'err' : 'ok'}
                statusTitle={!h.trusted ? t('tree.notTrusted') : down ? t('tree.hostDown') : t('status.ok')}
                onMore={(e) => pop(e, hostItems(h.id))}
                moreLabel={t('tree.hostActions', { name: h.name })}
              />
              {hOpen &&
                projects.map((p) => {
                  const key = `${h.id}/${p.id}`;
                  const pOpen = ui.open[key] ?? p.id === curProject;
                  const ss = sessions.byProject.get(p.id) ?? [];
                  return (
                    <div key={p.id}>
                      <TreeNode
                        level={1}
                        icon={p.isHome ? 'home' : 'folder'}
                        name={p.name}
                        title={p.rootPath}
                        expanded={pOpen}
                        onToggle={() => ui.toggle(key, !pOpen)}
                        selected={curProject === p.id && !curSid}
                        count={ss.filter((s) => s.status === 'awaiting').length}
                        onClick={() => {
                          ui.toggle(key, true);
                          openProject(nav, h.id, p.id, me.data?.preferences.lastTab?.[p.id], ss);
                        }}
                        onMore={(e) =>
                          // danh sách tmux có thể dài → để cuối, thao tác dự án không bị đẩy khỏi tầm nhìn
                          plusMenu(h.id, p.id, e.currentTarget.getBoundingClientRect(), setMenu, (items) => [
                            ...items.filter((x) => !x.group),
                            ...projectItems(h.id, p).map((x) => ({ ...x, group: t('tree.projectGroup') })),
                            ...items.filter((x) => x.group),
                          ])
                        }
                        moreLabel={t('tree.projectActions', { name: p.name })}
                      />
                      {pOpen &&
                        ss.map((s) => (
                          <Fragment key={s.id}>
                          <TreeNode
                            level={2}
                            icon={sessionIcon(s).name}
                            iconClass={sessionIcon(s).cls}
                            name={s.name}
                            title={s.note ? `${s.name}\n📝 ${s.note.text}` : s.name}
                            selected={curSid === s.id}
                            meta={s.status === 'awaiting' ? t('tree.needsApproval') : shortAgo(s.at)}
                            metaWarn={s.status === 'awaiting'}
                            status={s.status}
                            statusTitle={t(`status.${s.status}`)}
                            extra={s.bypass ? <span title={t('claude.mode_bypassPermissions_d')}><Icon name="warn" className="del" /></span> : undefined}
                            onClick={() => nav(sessionHref(h.id, s))}
                            onMore={(e) => pop(e, sessionItems(s))}
                            moreLabel={t('tree.sessionActions', { name: s.name })}
                          />
                          {s.note && (
                            // dòng ghi chú dưới phiên: nhìn cây là biết cửa sổ nào đang làm gì (Authority 2026-11-26)
                            <div className="tnote" title={s.note.text} onClick={() => nav(sessionHref(h.id, s))}>
                              <Icon name="note" className="note-ic" />
                              <span>{s.note.text}</span>
                            </div>
                          )}
                          </Fragment>
                        ))}
                      {pOpen && !ss.length && (
                        <TreeNode level={2} icon="plus" name={t('tree.noSessions')} muted onClick={() => newSession('terminal', h.id, p.id)} />
                      )}
                    </div>
                  );
                })}
            </div>
          );
        })}
        {!pins.isLoading && !pinned.length && (
          <div className="empty" style={{ margin: 'var(--space-md)' }}>
            <p className="sm">{t('tree.empty')}</p>
            <Button size="sm" onClick={() => nav('/hosts')}>
              {t('tree.pickHosts')}
            </Button>
          </div>
        )}
      </nav>
      {menu && <Menu anchor={menu.rect} items={menu.items} onClose={() => setMenu(null)} />}
    </>
  );
}
