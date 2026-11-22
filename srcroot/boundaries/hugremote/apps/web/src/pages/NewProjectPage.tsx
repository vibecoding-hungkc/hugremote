import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { pbase } from '../app/shell/sessions';
import { Button } from '../components/ui/Button';
import { Field } from '../components/ui/Field';
import { Icon } from '../components/ui/Icon';
import { toast } from '../components/ui/Overlay';
import { EmptyState, ErrorBox, Skeleton } from '../components/ui/States';
import { workspaceApi } from '../features/workspace/api/workspace.api';
import { qk, useHosts } from '../features/workspace/hooks/useWorkspace';
import { ApiError } from '../lib/api-client';

/** S5 — chọn thư mục làm dự án: breadcrumb, lên trên, thư mục mới (kiểm tên), tạo dự án idempotent (AC-7). */
export function NewProjectPage() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { hostId = 'local', path } = useParams();
  const dir = path ? decodeURIComponent(path) : undefined;
  const hosts = useHosts();
  const host = hosts.data?.hosts.find((h) => h.id === hostId);
  const browse = useQuery({ queryKey: ['browse', hostId, dir ?? ''], queryFn: () => workspaceApi.browse(hostId, dir) });
  const [newFolder, setNewFolder] = useState(false);
  const [folder, setFolder] = useState('');
  const [folderErr, setFolderErr] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const cur = browse.data?.path ?? dir ?? '';
  const go = (p: string) => nav(`/s/${encodeURIComponent(hostId)}/new-project/${encodeURIComponent(p)}`);
  const parts = cur.split('/').filter((s, i) => s || i === 0);
  const crumbPath = (i: number) => (cur.startsWith('/') ? '/' + parts.slice(1, i + 1).join('/') : parts.slice(0, i + 1).join('/')) || '/';
  const base = cur === '~' ? 'Home' : cur.split('/').filter(Boolean).pop() ?? cur;

  const makeFolder = async () => {
    const v = folder.trim();
    if (!v || /[/\\]/.test(v) || v === '.' || v === '..') return setFolderErr(t('newProject.folderInvalid'));
    try {
      const r = await workspaceApi.mkdir(hostId, `${cur.replace(/\/$/, '')}/${v}`);
      setNewFolder(false);
      setFolder('');
      toast(t('newProject.folderCreated', { name: v }));
      go(r.path);
    } catch (e) {
      setFolderErr(t(`errors.${e instanceof ApiError ? e.code : 'INTERNAL'}`));
    }
  };
  const create = async () => {
    setBusy(true);
    try {
      const existed = browse.data?.projectId;
      const p = await workspaceApi.createProject({ hostId, rootPath: cur, name: (name ?? base).trim() || base });
      await qc.invalidateQueries({ queryKey: qk.projects(hostId) });
      toast(existed ? t('newProject.exists', { name: p.name }) : t('newProject.created', { name: p.name }));
      nav(`${pbase(hostId, p.id)}/sessions`);
    } catch (e) {
      toast(t(`errors.${e instanceof ApiError ? e.code : 'INTERNAL'}`));
      setBusy(false);
    }
  };

  let inner;
  if (browse.isLoading) inner = <Skeleton rows={3} />;
  else if (browse.isError) {
    const code = browse.error instanceof ApiError ? browse.error.code : 'INTERNAL';
    inner = <ErrorBox title={t(`errors.${code}`)} actions={<Button size="sm" onClick={() => nav(`/s/${encodeURIComponent(hostId)}/new-project`)}>{t('newProject.backToRoot')}</Button>} />;
  } else if (browse.data?.entries.length)
    inner = (
      <div className="list">
        {browse.data.entries.map((e) => (
          <div className="row" key={e.name} tabIndex={0} onClick={() => go(`${cur.replace(/\/$/, '')}/${e.name}`)} onKeyDown={(k) => k.key === 'Enter' && go(`${cur.replace(/\/$/, '')}/${e.name}`)} style={e.hidden ? { opacity: 0.7 } : undefined}>
            <Icon name="folder" />
            <div className="t">
              <div className="t1">{e.name}</div>
            </div>
            <Icon name="chev" />
          </div>
        ))}
      </div>
    );
  else inner = <EmptyState icon="folder" message={t('newProject.emptyDir')} />;

  return (
    <div className="content" data-screen="S5" aria-label={t('nav.newProject')}>
      <div className="wrap">
        <p className="muted sm" style={{ marginTop: 0 }}>
          {t('newProject.lead', { host: host?.name ?? hostId })}
        </p>
        <div className="btns" style={{ marginBottom: 'var(--space-md)' }}>
          <nav className="crumb mono grow">
            {parts.map((seg, i) => (
              <span key={i} style={{ display: 'contents' }}>
                {i > 0 && <span className="sep">/</span>}
                <Button variant="ghost" size="sm" onClick={() => go(crumbPath(i))}>
                  {seg || '/'}
                </Button>
              </span>
            ))}
          </nav>
          {browse.data?.parent && <Button variant="ghost" size="sm" iconOnly icon="up" label={t('newProject.up')} onClick={() => go(browse.data!.parent!)} />}
          <Button variant="ghost" size="sm" iconOnly icon="folderplus" label={t('newProject.newFolder')} onClick={() => setNewFolder(true)} />
        </div>
        {newFolder && (
          <div className="card">
            <Field
              label={t('newProject.folderName', { path: cur })}
              mono
              autoFocus
              value={folder}
              placeholder="du-an-moi"
              error={folderErr ?? undefined}
              onChange={(e) => (setFolder(e.target.value), setFolderErr(null))}
              onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && void makeFolder()}
            />
            <div className="btns">
              <Button variant="primary" size="sm" write onClick={() => void makeFolder()}>
                {t('newProject.createFolder')}
              </Button>
              <Button size="sm" onClick={() => (setNewFolder(false), setFolderErr(null))}>
                {t('common.cancel')}
              </Button>
            </div>
          </div>
        )}
        {inner}
        <div className="card" style={{ marginTop: 'var(--space-xl)' }}>
          <Field label={t('newProject.displayName')} value={name ?? base} onChange={(e) => setName(e.target.value)} hint={<>{t('newProject.folder')} <span className="mono">{cur}</span> · {t('newProject.idempotentHint')}</>} />
          <div className="btns">
            <Button variant="primary" write loading={busy} disabled={!browse.data} onClick={() => void create()}>
              {browse.data?.projectId ? t('newProject.openExisting') : t('newProject.create')}
            </Button>
            <Button variant="ghost" onClick={() => history.back()}>
              {t('common.back')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
