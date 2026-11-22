import { PermissionMode, type ChatItem } from '@app/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { QuickOpen } from '../../app/shell/QuickOpen';
import { SessionBar } from '../../app/shell/SessionBar';
import { pbase, shortAgo } from '../../app/shell/sessions';
import { Icon } from '../../components/ui/Icon';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog, useDialogs } from '../../components/ui/Dialogs';
import { toast } from '../../components/ui/Overlay';
import { EmptyState, ErrorBox, Skeleton } from '../../components/ui/States';
import { useMe } from '../../features/auth/hooks/useMe';
import { claudeApi, type ClaudeSession } from '../../features/claude/api/claude.api';
import { ChatView, relToProject } from '../../features/claude/components/ChatView';
import { clearDraft, Composer } from '../../features/claude/components/Composer';
import { ck, useClaudeSessions } from '../../features/claude/hooks/useClaude';
import { useClaudeStream } from '../../features/claude/hooks/useClaudeStream';
import { useHosts, useProject } from '../../features/workspace/hooks/useWorkspace';
import { ApiError } from '../../lib/api-client';
import { useUi } from '../../stores/ui.store';
import { SplitView } from './SplitView';

const INSTALL_CMD = 'npm i -g @anthropic-ai/claude-code';

/**
 * S10 — Claude: `…/claude/new` (phiên mới, `?attach=` đính kèm sẵn) và `…/claude/<phiên>`.
 * `embed` → chỉ vẽ ô hội thoại (dùng ở ô phải khi chia ô, AC-35); phím tắt toàn trang chỉ gắn ở ô chính.
 */
export function ClaudePage({ embed }: { embed?: { hostId: string; projectId: string; sid: string } } = {}) {
  const { t } = useTranslation();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [search] = useSearchParams();
  const params = useParams();
  const { hostId = '', projectId = '', sid = '' } = embed ?? params;
  const isNew = sid === 'new';
  const me = useMe().data;
  const project = useProject(projectId).data;
  const host = useHosts().data?.hosts.find((h) => h.id === hostId);
  const sessions = useClaudeSessions();
  const cur = sessions.data?.find((s) => s.id === sid);
  const stream = useClaudeStream(!isNew && cur ? sid : undefined);
  const focus = useUi((s) => s.claudeFocus);
  const setUi = useUi((s) => s.set);
  const openDialog = useDialogs((s) => s.open);
  const opts = useQuery({ queryKey: ['claudeopts', projectId], queryFn: () => claudeApi.options(projectId), staleTime: 5 * 60_000, retry: false });
  const limits = useQuery({ queryKey: ['claudelimits', projectId], queryFn: () => claudeApi.limits(projectId), refetchInterval: 60_000 });
  const cli = useQuery({ queryKey: ['claudecli', projectId], queryFn: () => claudeApi.cliSessions(projectId), enabled: isNew, staleTime: 15_000 });
  const [quick, setQuick] = useState<((p: string) => void) | null>(null);
  // cấu hình của phiên mới (chưa có trên server)
  const [draftCfg, setDraftCfg] = useState<{ permissionMode: string; model?: string; effort?: string; confirm?: boolean }>({ permissionMode: PermissionMode.MANUAL });

  const base = pbase(hostId, projectId);
  const status = stream.ready ? stream.status : (cur?.status ?? 'idle');
  const running = status === 'running' || status === 'awaiting_input';
  const items = stream.items;
  const lastSummary = useMemo(() => [...items].reverse().find((m): m is Extract<ChatItem, { kind: 'summary' }> => m.kind === 'summary' && !!m.context), [items]);
  const notInstalled = status === 'error' && items[items.length - 1]?.kind === 'note' && (items[items.length - 1] as { text: string }).text === 'CLAUDE_NOT_INSTALLED';
  const firstAsk = items.find((m): m is Extract<ChatItem, { kind: 'interaction' }> => m.kind === 'interaction' && !m.decision && stream.pending.includes(m.id));

  useEffect(() => {
    // lượt xong → hạn mức có thể đã đổi
    void qc.invalidateQueries({ queryKey: ['claudelimits', projectId] });
  }, [lastSummary?.id, qc, projectId]);

  const fail = (e: unknown) => toast(t(`errors.${e instanceof ApiError ? e.code : 'INTERNAL'}`, { defaultValue: t('errors.INTERNAL') }));
  const refresh = () => qc.invalidateQueries({ queryKey: ck.sessions });
  const answer = (iid: string, d: 'allow' | 'deny' | 'always') =>
    claudeApi.answer(sid, iid, d).then(refresh, (e: unknown) => {
      fail(e);
      void refresh();
    });
  const stop = () => void claudeApi.cancel(sid).catch(fail);

  // Esc dừng lượt; ⌥Y / ⌥N trả lời yêu cầu quyền đầu tiên (AC-40, AC-49)
  useEffect(() => {
    if (embed) return;
    const on = (e: KeyboardEvent) => {
      if (document.querySelector('.scrim')) return;
      if (e.key === 'Escape' && running && !isNew) {
        e.preventDefault();
        stop();
      } else if (e.altKey && firstAsk && (e.code === 'KeyY' || e.code === 'KeyN')) {
        e.preventDefault();
        void answer(firstAsk.id, e.code === 'KeyY' ? 'allow' : 'deny');
      }
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  if (sessions.isLoading || !project || !me) return <div className="content"><Skeleton rows={3} /></div>;
  if (!isNew && !cur) {
    if (!sessions.data?.some((s) => s.projectId === projectId)) return <Navigate to={`${base}/sessions`} replace />;
    return (
      <div className="content" data-screen="S10">
        <ErrorBox title={t('session.notFound')} body={t('session.notFoundBody')} actions={<Button size="sm" onClick={() => nav('/')}>{t('nav.backToWorkspace')}</Button>} />
      </div>
    );
  }

  const hostName = host?.name ?? hostId;
  const patch = async (b: Parameters<typeof claudeApi.patch>[1]) => {
    if (isNew) return setDraftCfg((c) => ({ ...c, ...b }));
    try {
      const s = await claudeApi.patch(sid, b);
      qc.setQueryData<ClaudeSession[]>(ck.sessions, (l) => l?.map((x) => (x.id === s.id ? s : x)));
    } catch (e) {
      fail(e);
    }
  };
  const bypass = () =>
    openDialog(
      <ConfirmDialog
        danger
        title={t('claude.bypassTitle', { name: cur ? `"${cur.name}"` : t('claude.bypassNew') })}
        body={<p>{t('claude.bypassBody')}</p>}
        confirmLabel={t('claude.bypassConfirm')}
        onConfirm={() => patch({ permissionMode: PermissionMode.BYPASS, confirm: true })}
      />,
    );
  const resumeCli = (c: { id: string; title: string; recent: boolean }) => {
    const go = async () => {
      try {
        const s = await claudeApi.create(projectId, { resumeCliId: c.id, name: c.title });
        await refresh();
        void qc.invalidateQueries({ queryKey: ['claudecli', projectId] });
        nav(`${base}/claude/${s.id}`);
      } catch (e) {
        fail(e);
      }
    };
    if (!c.recent) return void go();
    openDialog(<ConfirmDialog title={t('claude.cliRecentTitle', { name: c.title })} body={<p>{t('claude.cliRecentBody')}</p>} confirmLabel={t('claude.resume')} onConfirm={go} />);
  };
  const draftSid = isNew ? `new:${projectId}` : sid;
  const send = async (text: string, attachments: string[]) => {
    try {
      if (isNew) {
        const s = await claudeApi.create(projectId, { ...draftCfg, name: text.replace(/\s+/g, ' ').slice(0, 40) } as Parameters<typeof claudeApi.create>[1]);
        await claudeApi.send(s.id, text, attachments);
        clearDraft(me.id, draftSid);
        await refresh();
        nav(`${base}/claude/${s.id}`, { replace: true });
        return true;
      }
      const r = await claudeApi.send(sid, text, attachments);
      if (r.queued) toast(t('claude.queuedToast'));
      void refresh();
      return true;
    } catch (e) {
      fail(e);
      return false;
    }
  };

  const composer = (
    <Composer
      key={draftSid}
      sid={draftSid}
      userId={me.id}
      running={running}
      mode={isNew ? draftCfg.permissionMode : (cur?.permissionMode ?? PermissionMode.MANUAL)}
      model={isNew ? draftCfg.model : cur?.model}
      effort={isNew ? draftCfg.effort : cur?.effort}
      options={opts.data}
      optionsError={opts.isError}
      context={lastSummary?.context ?? null}
      limits={limits.data}
      hostName={hostName}
      focus={focus}
      ask={firstAsk ? { id: firstAsk.id, what: `${firstAsk.tool} ${String(firstAsk.input.file_path ?? firstAsk.input.command ?? '').split('/').pop()}` } : null}
      initialAttach={isNew && search.get('attach') ? [search.get('attach')!] : undefined}
      onToggleFocus={() => setUi({ claudeFocus: !focus })}
      onMode={(m) => void patch({ permissionMode: m as PermissionMode })}
      onBypass={bypass}
      onModel={(b) => void patch(b)}
      onSend={send}
      onStop={stop}
      onAnswer={(iid, d) => void answer(iid, d)}
      onPickAttach={(add) => setQuick(() => add)}
    />
  );

  const quickBox = quick && <QuickOpen projectId={projectId} placeholder={t('quick.attachPlaceholder')} onClose={() => setQuick(null)} onPick={(p) => quick(p)} />;

  if (isNew)
    return (
      <div className="content flush" data-screen="S10" aria-label={t('claude.title')}>
        <SessionBar hostId={hostId} projectId={projectId} />
        <div className="chat">
          <div className="col">
            <EmptyState
              icon="claude"
              message={t('claude.intro', { path: project.rootPath, host: hostName })}
              action={(['sug1', 'sug2', 'sug3'] as const).map((k) => (
                <Button
                  key={k}
                  size="sm"
                  onClick={() => {
                    const ta = document.getElementById(`prompt-${draftSid}`) as HTMLTextAreaElement | null;
                    if (!ta) return;
                    // gán qua setter gốc để React nhận onChange
                    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(ta, t(`claude.${k}`));
                    ta.dispatchEvent(new Event('input', { bubbles: true }));
                    ta.focus();
                  }}
                >
                  {t(`claude.${k}`)}
                </Button>
              ))}
            />
            {!!cli.data?.length && (
              <>
                <div className="section-title">{t('claude.cliResume')}</div>
                <div className="list">
                  {cli.data.map((c) => (
                    <div key={c.id} className="row" role="button" tabIndex={0} onClick={() => resumeCli(c)} onKeyDown={(e) => e.key === 'Enter' && resumeCli(c)}>
                      <Icon name="claude" className="claude-ic" />
                      <div className="t">
                        <div className="t1">{c.title}</div>
                        <div className="t2">
                          {shortAgo(c.updatedAt)}
                          {c.recent && ` · ${t('claude.cliRecent')}`}
                        </div>
                      </div>
                      <span className="btn sm">{t('claude.resume')}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
        {composer}
        {quickBox}
      </div>
    );

  const pane = (
      <div className="pane">
        {notInstalled && (
          <div style={{ padding: 'var(--space-md) var(--space-md) 0' }}>
            <ErrorBox
              title={t('claude.notInstalled', { host: hostName })}
              body={t('claude.notInstalledBody')}
              actions={
                <>
                  <span className="fp grow">{INSTALL_CMD}</span>
                  <Button
                    size="sm"
                    iconOnly
                    icon="copy"
                    label={t('claude.copyCmd')}
                    onClick={() => void navigator.clipboard?.writeText(INSTALL_CMD).then(() => toast(t('claude.copied')))}
                  />
                </>
              }
            />
          </div>
        )}
        {!stream.ready ? (
          <div className="chat">
            <div className="col">
              <Skeleton rows={3} />
            </div>
          </div>
        ) : (
          <ChatView
            items={items}
            status={status}
            pending={stream.pending}
            queue={stream.queue}
            focus={focus}
            rootPath={project.rootPath}
            hostName={hostName}
            h={{
              openFile: (p, l) => nav(`${base}/files/${p.split('/').map(encodeURIComponent).join('/')}${l ? `/${l}` : ''}`),
              openDiff: (p) => nav(`${base}/git?file=${encodeURIComponent(relToProject(p, project.rootPath))}`),
              answer: (iid, d) => void answer(iid, d),
              unqueue: (qid) => void claudeApi.unqueue(sid, qid).catch(fail),
              resumeQueue: () => void claudeApi.resumeQueue(sid).catch(fail),
              toggleFocus: () => setUi({ claudeFocus: !focus }),
            }}
          />
        )}
        {composer}
        {embed && quickBox}
      </div>
  );
  if (embed) return pane;
  return (
    <div className="content flush" data-screen="S10" aria-label={t('claude.title')}>
      <SessionBar hostId={hostId} projectId={projectId} currentId={sid} />
      <SplitView hostId={hostId} projectId={projectId} currentId={sid}>
        {pane}
      </SplitView>
      {quickBox}
    </div>
  );
}
