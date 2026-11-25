import { useQuery, useQueryClient } from '@tanstack/react-query';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useParams } from 'react-router-dom';
import { SessionBar } from '../../app/shell/SessionBar';
import { useMissingSession, useSessions } from '../../app/shell/sessions';
import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/ui/Icon';
import { toast } from '../../components/ui/Overlay';
import { ErrorBox, Skeleton } from '../../components/ui/States';
import { filesApi } from '../../features/files/api/files.api';
import { forwardsApi } from '../../features/forwards/forwards.api';
import { desktop, webApi, type WebViewState } from '../../features/web/web.api';
import { qk, useProject } from '../../features/workspace/hooks/useWorkspace';
import { ApiError } from '../../lib/api-client';

/**
 * S13 — Phiên trình duyệt (vòng 3, AC-59). Một phiên = một trang; nhập link khác thì đổi trang ngay trong phiên (Q-9).
 * `http(s)://localhost|127.0.0.1` → `WebContentsView` native của app desktop đặt đúng ô `.webhost` (bounds qua IPC).
 * `file://…` → đọc qua files-api rồi hiện ngay trong app (webview tách cookie nên không đọc được API) — DECISIONS 2026-11-25.
 */
export function WebPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { hostId = '', projectId = '', sid = '' } = useParams();
  const sessions = useSessions();
  const cur = sessions.all.find((s) => s.id === sid && s.kind === 'web');
  const missing = useMissingSession(sid, !!cur, sessions.isLoading);
  const project = useProject(projectId).data;
  const bridge = desktop();
  const [addr, setAddr] = useState(cur?.url ?? '');
  const [st, setSt] = useState<WebViewState | null>(null);
  const host = useRef<HTMLDivElement>(null);
  const url = cur?.url ?? '';
  const isFile = url.startsWith('file://');
  const ssh = hostId !== 'local';

  useEffect(() => setAddr(url), [url]);
  const fw = useQuery({ queryKey: ['port-forwards'], queryFn: forwardsApi.list, enabled: ssh });
  const port = Number(/:(\d+)/.exec(url.replace(/^file:\/\//, ''))?.[1] ?? 0);
  const viaFw = fw.data?.find((f) => f.hostId === hostId && f.direction === 'L' && f.localPort === port);

  // webview native: hiện + đặt đúng ô, theo dõi kích thước; rời trang/đổi phiên → ẩn
  useEffect(() => {
    if (!bridge || !cur || isFile || !host.current) return;
    const el = host.current;
    const b = () => {
      const r = el.getBoundingClientRect();
      return { x: r.left, y: r.top, width: r.width, height: r.height };
    };
    void bridge.web.show(cur.id, url, b());
    const ro = new ResizeObserver(() => bridge.web.bounds(cur.id, b()));
    ro.observe(el);
    const onWin = () => bridge.web.bounds(cur.id, b());
    window.addEventListener('resize', onWin);
    const off = bridge.web.onState((s) => {
      if (s.id !== cur.id) return;
      setSt(s);
      // trang tự đi sang link khác (bấm link trong trang) → lưu lại địa chỉ của phiên
      if (s.url && s.url !== url && !s.loading && /^https?:\/\//.test(s.url)) void webApi.patch(cur.id, { url: s.url }).then(() => qc.invalidateQueries({ queryKey: qk.web }));
    });
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', onWin);
      off();
      bridge.web.hide(cur.id);
    };
  }, [bridge, cur?.id, url, isFile]); // eslint-disable-line react-hooks/exhaustive-deps

  // web thường không liệt kê phiên trình duyệt (trừ file://) → link sâu tới phiên http hiện errorBox Q-8 thay vì về `/`
  if (missing === 'gone' && bridge) return <Navigate to="/" replace state={{ notice: 'sessionGone' }} />;
  if (sessions.isLoading || !cur)
    return !bridge ? (
      <div className="content" data-screen="S13">
        <div className="wrap">
          <ErrorBox title={t('web.desktopOnly')} />
        </div>
      </div>
    ) : (
      <div className="content">
        <Skeleton rows={2} />
      </div>
    );

  const err = (e: unknown) => toast(t(`errors.${e instanceof ApiError ? e.code : 'INTERNAL'}`, { defaultValue: t('errors.INTERNAL') }));
  const go = async (u: string) => {
    try {
      await webApi.patch(cur.id, { url: u });
      await qc.invalidateQueries({ queryKey: qk.web });
    } catch (e) {
      err(e);
    }
  };
  return (
    <div className="content flush" data-screen="S13" aria-label={t('web.title')}>
      <SessionBar hostId={hostId} projectId={projectId} currentId={sid} />
      <div className="tabbar" style={{ gap: 'var(--space-xs)', padding: 'var(--space-xs) var(--space-sm)' }}>
        <Button variant="ghost" size="sm" iconOnly icon="back" label={t('web.back')} disabled={!st?.canBack} onClick={() => bridge?.web.nav(cur.id, 'back')} />
        <Button variant="ghost" size="sm" iconOnly icon="chev" label={t('web.forward')} disabled={!st?.canForward} onClick={() => bridge?.web.nav(cur.id, 'forward')} />
        <Button variant="ghost" size="sm" iconOnly icon="refresh" label={t('web.reload')} onClick={() => (isFile ? void qc.invalidateQueries({ queryKey: ['web-file', cur.id] }) : bridge?.web.nav(cur.id, 'reload'))} />
        <form className="grow" style={{ display: 'flex' }} onSubmit={(e) => (e.preventDefault(), void go(addr))}>
          <input className="input mono sm" style={{ width: '100%' }} aria-label={t('web.address')} value={addr} onChange={(e) => setAddr(e.target.value)} />
        </form>
        <span className="badge" title={t('web.via')}>
          <Icon name={isFile ? 'file' : 'fwd'} />
          {isFile ? hostId : viaFw ? `localhost:${viaFw.localPort} → ${hostId}:${viaFw.remotePort}` : `localhost:${port || ''}`}
        </span>
        {!isFile && <Button variant="ghost" size="sm" iconOnly icon="ext" label={t('web.external')} onClick={() => bridge?.web.nav(cur.id, 'external')} />}
        {!isFile && <Button variant="ghost" size="sm" iconOnly icon="cog" label={t('web.devtools')} onClick={() => bridge?.web.nav(cur.id, 'devtools')} />}
      </div>
      {isFile ? (
        <FileBody projectId={projectId} rootPath={project?.rootPath ?? ''} url={url} sid={cur.id} />
      ) : !bridge ? (
        <div className="content">
          <div className="wrap">
            <ErrorBox title={t('web.desktopOnly')} />
          </div>
        </div>
      ) : (
        <div className="pane" style={{ position: 'relative' }}>
          <div ref={host} className="webhost" style={{ position: 'absolute', inset: 0 }} />
          {st?.error && (
            <div className="content" style={{ position: 'absolute', inset: 0, background: 'var(--color-bg)' }}>
              <div className="wrap">
                <ErrorBox title={t('web.loadError', { url })} body={st.error} onRetry={() => bridge.web.nav(cur.id, 'reload')} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** `file://` — đọc qua files-api (đã có phiên người dùng), md render, html trong iframe sandbox, còn lại văn bản thô. */
function FileBody({ projectId, rootPath, url, sid }: { projectId: string; rootPath: string; url: string; sid: string }) {
  const { t } = useTranslation();
  const abs = url.slice(7);
  const rel = abs.startsWith(rootPath + '/') ? abs.slice(rootPath.length + 1) : abs;
  const q = useQuery({ queryKey: ['web-file', sid, rel], queryFn: () => filesApi.read(projectId, rel) });
  if (q.isLoading) return <div className="content"><Skeleton rows={4} /></div>;
  if (q.isError || !q.data) return <div className="content"><div className="wrap"><ErrorBox title={t('web.fileError', { path: rel })} onRetry={() => void q.refetch()} /></div></div>;
  const text = (q.data as { content?: string }).content ?? '';
  // script chạy được (bấm thao tác) nhưng không `allow-same-origin` → trang không đọc được cookie/phiên của HugRemote
  if (/\.html?$/i.test(rel))
    return <iframe title={rel} sandbox="allow-scripts allow-forms allow-modals allow-popups" srcDoc={text} style={{ flex: 1, border: 0, background: 'var(--color-bg)' }} />;
  return (
    <div className="pane" style={{ overflow: 'auto', background: 'var(--color-bg)' }}>
      <div className="wrap" style={{ padding: 'var(--space-xl)' }}>
        {/\.(md|markdown)$/i.test(rel) ? <div className="md" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(marked.parse(text, { async: false, gfm: true })) }} /> : <pre className="mono">{text}</pre>}
      </div>
    </div>
  );
}
