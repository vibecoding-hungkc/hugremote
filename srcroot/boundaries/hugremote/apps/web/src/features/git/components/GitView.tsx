import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/ui/Button';
import { ConfirmDialog, useDialogs } from '../../../components/ui/Dialogs';
import { DiffBlock } from '../../../components/ui/DiffBlock';
import { Icon } from '../../../components/ui/Icon';
import { Menu, toast, type MenuItem } from '../../../components/ui/Overlay';
import { EmptyState, ErrorBox, Skeleton } from '../../../components/ui/States';
import { ApiError } from '../../../lib/api-client';
import { useConnection } from '../../../lib/connection';
import { gitApi, type GitChange, type GitStatus } from '../api/git.api';

const disp = (f: string) => {
  const parts = f.split('/');
  const name = parts.pop();
  return (
    <>
      <span className="sm">{name}</span> <span className="xs muted">{parts.join('/')}</span>
    </>
  );
};

/** S9 — Git: nhánh + ahead/behind, fetch/pull/push (icon + số), thay đổi staged/chưa, diff, commit ⌘Enter, lịch sử. */
export function GitView({ projectId, history, onHistory, onOpenFile }: { projectId: string; history: boolean; onHistory: (on: boolean) => void; onOpenFile: (path: string) => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const online = useConnection((s) => s.online);
  const openDialog = useDialogs((s) => s.open);
  const key = ['git', projectId] as const;
  const st = useQuery({ queryKey: key, queryFn: () => gitApi.status(projectId), refetchInterval: 15_000 });
  const [sel, setSel] = useState<{ path: string; staged: boolean } | null>(null);
  const [pane, setPane] = useState(false);
  const [msg, setMsg] = useState(() => sessionStorage.getItem(`commitmsg:${projectId}`) ?? '');
  const [busy, setBusy] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ rect: DOMRect; items: MenuItem[] } | null>(null);
  const [commitSel, setCommitSel] = useState<string | null>(null);

  const g = st.data;
  const changes = g?.changes ?? [];
  const cur = sel ?? (changes[0] ? { path: changes[0].path, staged: changes[0].staged && !changes[0].unstaged } : null);
  const diff = useQuery({ queryKey: ['gitdiff', projectId, cur?.path, cur?.staged, g?.changes.length], queryFn: () => gitApi.diff(projectId, cur!.path, cur!.staged), enabled: !!cur && !history });
  const commits = useInfiniteQuery({
    queryKey: ['gitlog', projectId],
    queryFn: ({ pageParam }) => gitApi.commits(projectId, pageParam),
    initialPageParam: 0,
    getNextPageParam: (p) => p.next ?? undefined,
    enabled: history,
  });
  const allCommits = commits.data?.pages.flatMap((p) => p.commits) ?? [];
  const curCommit = commitSel ?? allCommits[0]?.sha;
  const [commitFile, setCommitFile] = useState<string | null>(null);
  const detail = useQuery({ queryKey: ['gitcommit', projectId, curCommit, commitFile], queryFn: () => gitApi.commit1(projectId, curCommit!, commitFile ?? undefined), enabled: history && !!curCommit });

  const run = async (label: string, fn: () => Promise<GitStatus>, ok?: string) => {
    setBusy(label);
    try {
      qc.setQueryData(key, await fn());
      if (ok) toast(ok);
      return true;
    } catch (e) {
      const code = e instanceof ApiError ? e.code : 'INTERNAL';
      toast(t(`errors.${code}`, { defaultValue: t('errors.INTERNAL') }));
      void st.refetch();
      return false;
    } finally {
      setBusy(null);
    }
  };
  const doCommit = async () => {
    if (!msg.trim() || !changes.some((c) => c.staged)) return;
    if (await run('commit', () => gitApi.commit(projectId, msg.trim()), t('git.committed'))) {
      setMsg('');
      sessionStorage.removeItem(`commitmsg:${projectId}`);
      void qc.invalidateQueries({ queryKey: ['gitlog', projectId] });
    }
  };
  const discard = (c: GitChange) =>
    openDialog(
      <ConfirmDialog
        danger
        title={t('git.discardTitle', { name: c.path.split('/').pop() })}
        body={<p>{c.untracked ? t('git.discardUntracked') : t('git.discardBody')}</p>}
        confirmLabel={t('git.discard')}
        onConfirm={async () => {
          qc.setQueryData(key, await gitApi.discard(projectId, c.path));
          toast(t('git.discarded'));
        }}
      />,
    );
  const branchMenu = async (e: MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const b = await gitApi.branches(projectId).catch(() => null);
    if (!b) return;
    setMenu({
      rect,
      items: [
        ...b.local.map((n) => ({ group: t('git.localBranches'), icon: 'git' as const, label: n === b.current ? `${n} · ${t('git.current')}` : n, disabled: n === b.current, onSelect: () => void run('checkout', () => gitApi.checkout(projectId, n), t('git.switched', { name: n })) })),
        ...b.remote.map((n) => ({ group: t('git.remoteBranches'), icon: 'git' as const, label: n, onSelect: () => void run('checkout', () => gitApi.checkout(projectId, n), t('git.switched', { name: n })) })),
      ],
    });
  };

  if (st.isLoading) return <div className="content" data-screen="S9"><Skeleton rows={4} /></div>;
  if (st.isError) {
    const code = st.error instanceof ApiError ? st.error.code : 'INTERNAL';
    return <div className="content" data-screen="S9"><ErrorBox title={t(`errors.${code}`)} onRetry={() => void st.refetch()} /></div>;
  }
  if (!g?.isRepo) return <div className="content" data-screen="S9"><EmptyState icon="git" message={t('git.notRepo')} /></div>;

  const staged = changes.filter((c) => c.staged);
  const unstaged = changes.filter((c) => c.unstaged);
  const row = (c: GitChange, isStaged: boolean) => {
    const on = cur?.path === c.path && cur.staged === isStaged;
    const code = c.untracked ? 'A' : isStaged ? c.x : c.y;
    return (
      <div
        key={(isStaged ? 's:' : 'u:') + c.path}
        className={`grow-row ${on ? 'sel' : ''}`}
        tabIndex={0}
        onClick={() => (setSel({ path: c.path, staged: isStaged }), setPane(true))}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (setSel({ path: c.path, staged: isStaged }), setPane(true));
          if (e.key === ' ') (e.preventDefault(), void run('stage', () => (isStaged ? gitApi.unstage(projectId, [c.path]) : gitApi.stage(projectId, [c.path]))));
        }}
      >
        <span className={`mono xs ${code === 'A' ? 'add' : code === 'D' ? 'del' : 'muted'}`}>{code}</span>
        <span className="ell grow">{disp(c.path)}</span>
        <span className="xs">
          <span className="add">+{c.added}</span> <span className="del">−{c.deleted}</span>
        </span>
        {!isStaged && <Button variant="ghost" size="sm" iconOnly icon="undo" className="act" write label={t('git.discardTip')} onClick={(e) => (e.stopPropagation(), discard(c))} />}
        <Button
          variant="ghost"
          size="sm"
          iconOnly
          icon={isStaged ? 'minus' : 'plus'}
          write
          label={isStaged ? t('git.unstage') : t('git.stage')}
          onClick={(e) => {
            e.stopPropagation();
            void run('stage', () => (isStaged ? gitApi.unstage(projectId, [c.path]) : gitApi.stage(projectId, [c.path])));
          }}
        />
      </div>
    );
  };

  const branch = (
    <div className="grow-row" style={{ cursor: 'default' }}>
      <Icon name="git" className="git-ic" />
      <div className="t grow">
        <button className="linkp mono sm ell" style={{ color: 'var(--color-text)' }} title={t('git.switchBranch')} onClick={(e) => void branchMenu(e)}>
          {g.branch ?? 'HEAD'} ▾
        </button>
        <div className="xs muted">
          {g.ahead ? t('git.ahead', { count: g.ahead }) : g.behind ? t('git.behind', { count: g.behind }) : g.upstream ? t('git.synced', { up: g.upstream }) : t('git.noUpstream')}
        </div>
      </div>
      <Button variant="ghost" size="sm" iconOnly icon="refresh" label={t('git.fetch')} loading={busy === 'fetch'} write onClick={() => void run('fetch', () => gitApi.fetch(projectId), t('git.fetched'))} />
      <Button variant="ghost" size="sm" iconOnly icon="pull" label={t('git.pull')} loading={busy === 'pull'} write onClick={() => void run('pull', () => gitApi.pull(projectId), t('git.pulled'))} />
      <Button
        variant={g.ahead ? 'primary' : 'secondary'}
        size="sm"
        icon="push"
        write
        label={t('git.push')}
        aria-label={t('git.push')}
        title={g.ahead || !g.upstream ? t('git.pushTo', { up: g.upstream ?? 'origin' }) : t('git.nothingToPush')}
        disabled={!!g.upstream && !g.ahead}
        loading={busy === 'push'}
        onClick={() => void run('push', () => gitApi.push(projectId), t('git.pushed'))}
      >
        {g.ahead ? <span className="num">{g.ahead}</span> : null}
      </Button>
    </div>
  );
  const tabs = (
    <div className="seg" style={{ margin: 'var(--space-sm) var(--space-md)' }}>
      <button className={history ? '' : 'on'} onClick={() => (onHistory(false), setPane(false))}>
        {t('git.changes', { count: changes.length })}
      </button>
      <button className={history ? 'on' : ''} onClick={() => (onHistory(true), setPane(false))}>
        {t('git.history')}
      </button>
    </div>
  );

  let left;
  let right;
  if (!history) {
    left = (
      <>
        {branch}
        {tabs}
        {!changes.length ? (
          <EmptyState icon="git" message={t('git.clean')} />
        ) : (
          <>
            <div className="gsec">
              <span className="grow">{t('git.stagedSec', { count: staged.length })}</span>
              {!!staged.length && <Button variant="ghost" size="sm" iconOnly icon="minus" write label={t('git.unstageAll')} onClick={() => void run('stage', () => gitApi.unstage(projectId, ['*']))} />}
            </div>
            {staged.map((c) => row(c, true))}
            {!staged.length && <p className="muted xs" style={{ margin: '0 var(--space-md) var(--space-sm)' }}>{t('git.noneStaged')}</p>}
            <div className="gsec">
              <span className="grow">{t('git.unstagedSec', { count: unstaged.length })}</span>
              {!!unstaged.length && <Button variant="ghost" size="sm" iconOnly icon="plus" write label={t('git.stageAll')} onClick={() => void run('stage', () => gitApi.stage(projectId, ['*']))} />}
            </div>
            {unstaged.map((c) => row(c, false))}
            <div className="commitbox">
              <textarea
                className="input"
                rows={2}
                placeholder={t('git.msgPh')}
                value={msg}
                onChange={(e) => (setMsg(e.target.value), sessionStorage.setItem(`commitmsg:${projectId}`, e.target.value))}
                onKeyDown={(e) => e.key === 'Enter' && (e.metaKey || e.ctrlKey) && void doCommit()}
              />
              <Button variant="primary" icon="commit" write loading={busy === 'commit'} disabled={!staged.length || !msg.trim()} disabledReason={!staged.length ? t('git.noneStaged') : t('git.needMsg')} title={`${t('git.commit')} (⌘Enter)`} onClick={() => void doCommit()}>
                {t('git.commitN', { count: staged.length })}
              </Button>
            </div>
          </>
        )}
      </>
    );
    right = cur ? (
      <>
        <div className="pane-head">
          <span className="only-mobile">
            <Button variant="ghost" size="sm" iconOnly icon="back" label={t('git.backToChanges')} onClick={() => setPane(false)} />
          </span>
          <Icon name="file" />
          <span className="mono ell grow">{cur.path}</span>
          <Button variant="ghost" size="sm" iconOnly icon="file" label={t('git.openFile')} onClick={() => onOpenFile(cur.path)} />
          <Button variant="ghost" size="sm" iconOnly icon="copy" label={t('files.copyPath')} onClick={() => void navigator.clipboard?.writeText(cur.path).then(() => toast(t('files.copied', { path: cur.path })))} />
        </div>
        {diff.isLoading ? <Skeleton rows={4} /> : <DiffBlock diff={diff.data?.diff ?? ''} />}
      </>
    ) : (
      <div className="special muted">{t('git.noDiff')}</div>
    );
  } else {
    left = (
      <>
        {branch}
        {tabs}
        {commits.isLoading && <Skeleton rows={5} />}
        {allCommits.map((c) => (
          <div key={c.sha} className={`grow-row ${curCommit === c.sha ? 'sel' : ''}`} style={{ minHeight: 56 }} tabIndex={0} onClick={() => (setCommitSel(c.sha), setCommitFile(null), setPane(true))}>
            <div className="t grow">
              <div className="sm ell">{c.subject}</div>
              <div className="xs muted ell">
                <span className="mono">{c.short}</span> · {c.author} · {new Date(c.date).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}
              </div>
            </div>
            <Button variant="ghost" size="sm" iconOnly icon="copy" className="act" label={t('git.copySha')} onClick={(e) => (e.stopPropagation(), void navigator.clipboard?.writeText(c.sha).then(() => toast(t('files.copied', { path: c.short }))))} />
          </div>
        ))}
        {commits.hasNextPage && (
          <div style={{ padding: 'var(--space-md)' }}>
            <Button size="sm" block loading={commits.isFetchingNextPage} onClick={() => void commits.fetchNextPage()}>
              {t('git.more')}
            </Button>
          </div>
        )}
      </>
    );
    const d = detail.data;
    right = d ? (
      <>
        <div className="pane-head">
          <span className="only-mobile">
            <Button variant="ghost" size="sm" iconOnly icon="back" label={t('git.backToCommits')} onClick={() => setPane(false)} />
          </span>
          <span className="mono">{d.sha.slice(0, 7)}</span>
          <span className="grow ell">{d.message.split('\n')[0]}</span>
        </div>
        <div style={{ flex: 'none', borderBottom: '1px solid var(--color-divider)', maxHeight: '40%', overflow: 'auto' }}>
          {d.files.map((f) => (
            <div key={f.path} className={`grow-row ${commitFile === f.path ? 'sel' : ''}`} tabIndex={0} onClick={() => setCommitFile(f.path)}>
              <Icon name="file" />
              <span className="ell grow">{disp(f.path)}</span>
              <span className="xs">
                <span className="add">+{f.added}</span> <span className="del">−{f.deleted}</span>
              </span>
              <Button variant="ghost" size="sm" iconOnly icon="file" label={t('git.openFile')} onClick={(e) => (e.stopPropagation(), onOpenFile(f.path))} />
            </div>
          ))}
        </div>
        {commitFile ? <DiffBlock diff={d.diff ?? ''} /> : <div className="special muted">{t('git.pickFile')}</div>}
      </>
    ) : (
      <Skeleton rows={4} />
    );
  }

  return (
    <div className="content flush" data-screen="S9" aria-label="Git">
      {!online && null}
      <div className={`git ${pane ? 'open' : ''}`}>
        <aside className="gleft">{left}</aside>
        <section className="pane gright">{right}</section>
      </div>
      {menu && <Menu anchor={menu.rect} items={menu.items} onClose={() => setMenu(null)} />}
    </div>
  );
}
