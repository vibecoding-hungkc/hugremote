import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { DialogHost } from '../../components/ui/Dialogs';
import { Icon } from '../../components/ui/Icon';
import { ToastHost } from '../../components/ui/Overlay';
import { useMe } from '../../features/auth/hooks/useMe';
import { useHosts, useProject } from '../../features/workspace/hooks/useWorkspace';
import { useConnection } from '../../lib/connection';
import { startEvents } from '../../lib/events';
import { midTrunc } from '../../lib/text';
import { useUi } from '../../stores/ui.store';
import { NotifBell } from './NotifBell';
import { QuickOpen } from './QuickOpen';
import { pbase } from './sessions';
import { KeysDialog, Spotlight } from './Spotlight';
import { onFileChanged } from './useFileEvents';
import { useShortcuts } from './useShortcuts';
import { usePreferences } from '../usePreferences';
import { ProjectTabs } from './ProjectTabs';
import { WorkspaceTree } from './WorkspaceTree';

/** C13 — dải mất kết nối: khi hiện, mọi nút ghi khoá (C1 `write`), nháp giữ nguyên. */
export function ConnBar() {
  const { t } = useTranslation();
  const { online, attempt } = useConnection();
  if (online) return null;
  return (
    <div className="conn" role="status">
      <span className="dot warn" />
      <span className="grow">{t('net.banner', { n: attempt })}</span>
      <Button size="sm" icon="refresh" onClick={() => location.reload()}>
        {t('net.retryNow')}
      </Button>
    </div>
  );
}

function Topbar() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const loc = useLocation();
  const { hostId, projectId } = useParams();
  const ui = useUi();
  const hosts = useHosts();
  const project = useProject(projectId);
  const host = hosts.data?.hosts.find((h) => h.id === hostId);
  const owner = useMe().data?.role === 'owner';
  const titles: Record<string, string> = { '/hosts': t('nav.hosts'), '/settings': t('nav.settings'), '/ports': t('fw.title') };
  const title = titles[loc.pathname] ?? (loc.pathname.includes('/new-project') ? t('nav.newProject') : t('nav.workspace'));
  const inProject = !!(hostId && projectId);
  return (
    <>
      <header className="topbar">
        <span className="only-desk">
          <Button variant="ghost" size="sm" iconOnly icon="sidebar" label={t(ui.noSide ? 'nav.showSide' : 'nav.hideSide')} onClick={() => ui.set({ noSide: !ui.noSide })} />
        </span>
        <span className="only-narrow hide-mobile">
          <Button variant="ghost" size="sm" iconOnly icon="menu" label={t('nav.openSide')} onClick={() => ui.set({ sideOpen: !ui.sideOpen })} />
        </span>
        {(inProject || hostId) && (
          <span className="only-mobile">
            <Button variant="ghost" size="sm" iconOnly icon="back" label={t('nav.backToWorkspace')} onClick={() => nav('/')} />
          </span>
        )}
        <div className="grow">
          {host ? (
            <nav className="crumb" aria-label={t('nav.scope')}>
              <Icon name={host.kind === 'local' ? 'home' : 'server'} />
              <b>{host.kind === 'local' ? t('hosts.thisMachineShort') : host.name}</b>
              {project.data && (
                <>
                  <span className="sep">›</span>
                  <b>{project.data.name}</b>
                  <span className="muted mono xs hide-mobile" title={project.data.rootPath}>
                    {midTrunc(project.data.rootPath, 40)}
                  </span>
                </>
              )}
            </nav>
          ) : (
            <b>{title}</b>
          )}
        </div>
        {inProject && <ProjectTabs hostId={hostId} projectId={projectId} />}
        {inProject && !/\/(sessions|terminal\/|claude\/)/.test(loc.pathname) && <NotifBell hostId={hostId} projectId={projectId} />}
        {/* vòng 3: tìm kiếm chỉ ở thanh bên khi có thanh bên; điện thoại giữ nút */}
        <span className="only-mobile">
          <Button variant="ghost" size="sm" iconOnly icon="search" label={`${t('nav.quickSwitch')} (⌘K)`} onClick={() => ui.set({ spot: true })} />
        </span>
        {owner && (
          <span className="hide-mobile">
            <Button variant="ghost" size="sm" iconOnly icon="fwd" tone={loc.pathname === '/ports' ? 'primary' : undefined} label={t('fw.title')} onClick={() => nav('/ports')} />
          </span>
        )}
        <span className="hide-mobile">
          <Button variant="ghost" size="sm" iconOnly icon="cog" tone={loc.pathname === '/settings' ? 'primary' : undefined} label={t('nav.settings')} onClick={() => nav('/settings')} />
        </span>
      </header>
      {inProject && <ProjectTabs hostId={hostId} projectId={projectId} mobile />}
    </>
  );
}

function BottomBar() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const loc = useLocation();
  const tab = loc.pathname.startsWith('/hosts') ? 'hosts' : loc.pathname.startsWith('/settings') ? 'settings' : 'ws';
  return (
    <nav className="bottombar" aria-label={t('nav.main')}>
      <button className={tab === 'ws' ? 'on' : ''} onClick={() => nav('/')}>
        <Icon name="folder" />
        {t('nav.workspaceShort')}
      </button>
      <button className={tab === 'hosts' ? 'on' : ''} onClick={() => nav('/hosts')}>
        <Icon name="server" />
        {t('nav.hosts')}
      </button>
      <button className={tab === 'settings' ? 'on' : ''} onClick={() => nav('/settings')}>
        <Icon name="cog" />
        {t('nav.settings')}
      </button>
    </nav>
  );
}

/** Vỏ app kiểu Orca: thanh bên cây + vùng chính; mobile: cây ở S2 + thanh dưới (AC-12). */
export function AppShell() {
  const { t } = useTranslation();
  const ui = useUi();
  const qc = useQueryClient();
  const loc = useLocation();
  const { hostId, projectId } = useParams();
  const nav = useNavigate();
  const me = useMe();
  useShortcuts();
  usePreferences(me.data?.preferences);
  useEffect(
    () =>
      startEvents(qc, {
        interaction_requested: () => void qc.invalidateQueries({ queryKey: ['claude'] }),
        interaction_answered: () => void qc.invalidateQueries({ queryKey: ['claude'] }),
        turn_finished: () => void qc.invalidateQueries({ queryKey: ['claude'] }),
        file_changed: (d) => void onFileChanged(qc, d),
      }),
    [qc],
  );
  useEffect(() => ui.set({ sideOpen: false }), [loc.pathname]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className={`shell ${ui.sideOpen ? 'side-open' : ''} ${ui.noSide ? 'noside' : ''}`}>
      <aside className="sidebar" aria-label={t('tree.title')}>
        <div className="side-head">
          <span className="logo-dot" />
          <Link to="/" style={{ color: 'inherit', textDecoration: 'none' }}>
            {t('app.name')}
          </Link>
          <span className="grow" />
          <span className="only-narrow">
            <Button variant="ghost" size="sm" iconOnly icon="x" label={t('common.close')} onClick={() => ui.set({ sideOpen: false })} />
          </span>
        </div>
        <button className="search-btn" onClick={() => ui.set({ spot: true })}>
          <Icon name="search" />
          {t('nav.quickSwitch')}
          <kbd>⌘K</kbd>
        </button>
        <WorkspaceTree />
        <div className="side-foot">
          <Link className="btn ghost block" style={{ justifyContent: 'flex-start' }} to="/hosts">
            <Icon name="server" />
            {me.data?.role === 'owner' ? t('nav.manageHosts') : t('nav.hosts')}
          </Link>
        </div>
      </aside>
      <div className="main">
        <Topbar />
        <ConnBar />
        <Outlet />
        {!projectId && <BottomBar />}
      </div>
      {ui.spot && <Spotlight hostId={hostId} projectId={projectId} onClose={() => ui.set({ spot: false })} />}
      {ui.keys && <KeysDialog onClose={() => ui.set({ keys: false })} />}
      {ui.quick && projectId && hostId && (
        <QuickOpen
          projectId={projectId}
          onClose={() => ui.set({ quick: false })}
          onPick={(p, l) => nav(`${pbase(hostId, projectId)}/files/${p.split('/').map(encodeURIComponent).join('/')}${l ? `/${l}` : ''}`)}
        />
      )}
      <DialogHost />
      <ToastHost />
    </div>
  );
}
