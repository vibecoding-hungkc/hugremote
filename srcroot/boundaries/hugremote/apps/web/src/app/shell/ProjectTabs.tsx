import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { Icon } from '../../components/ui/Icon';
import { pbase, useSessions } from './sessions';

/** C16 — tab dự án Phiên · Files · Git (Ctrl+1/2/3). Phiên = gộp Claude + terminal (Authority lượt 1). */
export function ProjectTabs({ hostId, projectId, mobile }: { hostId: string; projectId: string; mobile?: boolean }) {
  const { t } = useTranslation();
  const nav = useNavigate();
  const loc = useLocation();
  const sessions = useSessions().byProject.get(projectId) ?? [];
  const base = pbase(hostId, projectId);
  const tail = loc.pathname.slice(base.length + 1);
  const on = tail.startsWith('files') ? 'files' : tail.startsWith('git') ? 'git' : 'sessions';
  const need = sessions.filter((s) => s.status === 'awaiting').length;
  const sessHref = sessions[0] ? `${base}/${sessions[0].kind}/${sessions[0].id}` : `${base}/sessions`;
  const tab = (key: string, label: string, icon: 'sessions' | 'file' | 'git', href: string, kbd: string, extra?: React.ReactNode) => (
    <button className={`ptab ${on === key ? 'on' : ''}`} title={`${label} (${kbd})`} aria-current={on === key ? 'page' : undefined} onClick={() => nav(on === key && key === 'sessions' ? loc.pathname : href)}>
      <Icon name={icon} />
      {label}
      {extra}
    </button>
  );
  return (
    <nav className={`ptabs ${mobile ? 'ptabs-m' : 'ptabs-d'}`} aria-label={t('tabs.label')}>
      {tab('sessions', t('tabs.sessions'), 'sessions', sessHref, 'Ctrl+1', need ? <span className="cnt">{need}</span> : null)}
      {tab('files', t('tabs.files'), 'file', `${base}/files`, 'Ctrl+2')}
      {tab('git', t('tabs.git'), 'git', `${base}/git`, 'Ctrl+3')}
    </nav>
  );
}
