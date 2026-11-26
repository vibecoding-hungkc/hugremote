import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState, type MouseEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/ui/Button';
import { ConfirmDialog, useDialogs } from '../../../components/ui/Dialogs';
import { DiffBlock } from '../../../components/ui/DiffBlock';
import { Icon } from '../../../components/ui/Icon';
import { Menu, toast, type MenuItem } from '../../../components/ui/Overlay';
import { EmptyState, ErrorBox, Skeleton } from '../../../components/ui/States';
import { ApiError } from '../../../lib/api-client';
import { blockedOffline, useConnection } from '../../../lib/connection';
import { useProject } from '../../workspace/hooks/useWorkspace';
import { gitFor, gitRepos, type GitChange, type GitStatus } from '../api/git.api';

const disp = (f: string) => {
  const parts = f.split('/');
  const name = parts.pop();
  return (
    <>
      <span className="sm">{name}</span> <span className="xs muted">{parts.join('/')}</span>
    </>
  );
};

type GitViewProps = { projectId: string; history: boolean; onHistory: (on: boolean) => void; onOpenFile: (path: string) => void; focusPath?: string; compact?: boolean };
const repoKey = (projectId: string) => `gitrepo:${projectId}`;
const loadRepo = (projectId: string) => {
  try {
    return localStorage.getItem(repoKey(projectId));
  } catch {
    return null;
  }
};

/**
 * S9 — Git. Thư mục dự án có thể chứa nhiều repo (sâu tối đa 4 cấp): hiện hết thành danh sách ở đầu cột trái, chọn dòng =
 * cả tab chuyển sang repo đó; mỗi dự án nhớ repo đang chọn (Authority 2026-11-25). Chỉ một repo ở gốc → giữ giao diện cũ.
 */
export function GitView(props: GitViewProps) {
  const { t } = useTranslation();
  const repos = useQuery({ queryKey: ['gitrepos', props.projectId], queryFn: () => gitRepos(props.projectId), refetchInterval: 30_000 });
  const project = useProject(props.projectId).data;
  const [pick, setPick] = useState<string | null>(() => loadRepo(props.projectId));
  const list = repos.data?.repos ?? [];
  const repo = list.some((r) => r.path === pick) ? pick! : (list[0]?.path ?? '');
  const choose = (p: string, keyboard = false) => {
    setPick(p);
    // đổi repo dựng lại cả cột → trả focus về dòng vừa chọn (dogfood a11y #5)
    if (keyboard) requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-repo="${CSS.escape(p)}"]`)?.focus());
    try {
      localStorage.setItem(repoKey(props.projectId), p);
    } catch {
      /* chế độ riêng tư */
    }
  };
  if (repos.isLoading) return <div className="content" data-screen="S9"><Skeleton rows={3} /></div>;
  // lỗi quét repo ≠ "chưa có repo" (dogfood picky V2)
  if (repos.isError) {
    const code = repos.error instanceof ApiError ? repos.error.code : 'INTERNAL';
    return <div className="content" data-screen="S9"><ErrorBox title={t(`errors.${code}`, { defaultValue: t('errors.INTERNAL') })} onRetry={() => void repos.refetch()} /></div>;
  }
  const header =
    list.length > 1 || (list.length === 1 && list[0].path !== '') ? (
      <>
        <div className="gsec">
          <span className="grow">{t('git.reposSec', { count: list.length })}</span>
        </div>
        {/* nhiều repo (vd Home) → khung cao ~5 dòng, cuộn riêng; nhánh + thay đổi của repo đang chọn luôn thấy */}
        <div className="repolist" role="listbox" aria-label={t('git.reposSec', { count: list.length })}>
        {list.map((r) => (
          <div
            key={r.path}
            ref={(el) => void (r.path === repo && el?.scrollIntoView({ block: 'nearest' }))}
            className={`grow-row ${r.path === repo ? 'sel' : ''}`}
            role="option"
            data-repo={r.path}
            aria-selected={r.path === repo}
            aria-label={`${r.path || project?.name || ''} · ${r.branch ?? 'HEAD'}${r.changes ? ` · ${t('git.changes', { count: r.changes })}` : ''}`}
            // một điểm dừng Tab cho cả danh sách (dòng đang chọn); ↑↓ đi giữa các repo
            tabIndex={r.path === repo ? 0 : -1}
            onClick={() => choose(r.path)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') (e.preventDefault(), choose(r.path, true));
              if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                const sib = (e.key === 'ArrowDown' ? e.currentTarget.nextElementSibling : e.currentTarget.previousElementSibling) as HTMLElement | null;
                sib?.focus();
              }
            }}
          >
            <Icon name={r.path === repo ? 'folder' : 'git'} className={r.path === repo ? 'git-ic' : ''} />
            <span className="mono sm ell grow">
              {r.path || (
                <>
                  {project?.name} <span className="muted xs">{t('git.projectRoot')}</span>
                </>
              )}
            </span>
            <span className="xs muted">{r.branch ?? 'HEAD'}</span>
            {!!r.changes && <span className="cnt">{r.changes}</span>}
          </div>
        ))}
        {!!repos.data?.more && (
          <div className="grow-row muted xs" style={{ cursor: 'default' }}>
            {t('git.reposMore', { count: repos.data.more })}
          </div>
        )}
        </div>
      </>
    ) : null;
  return <RepoGit key={repo} {...props} repo={repo} header={header} listed={list.find((r) => r.path === repo)?.changes} />;
}

function RepoGit({ projectId, history, onHistory, onOpenFile: openProjectFile, focusPath, compact, repo, header, listed }: GitViewProps & { repo: string; header: ReactNode; listed?: number }) {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const online = useConnection((s) => s.online);
  const openDialog = useDialogs((s) => s.open);
  const ga = useMemo(() => gitFor(projectId, repo), [projectId, repo]);
  // đường dẫn git tương đối với repo → mở file cần đường dẫn tương đối với dự án
  const onOpenFile = (p: string) => openProjectFile(repo ? `${repo}/${p}` : p);
  const key = ['git', projectId, repo] as const;
  const st = useQuery({ queryKey: key, queryFn: () => ga.status(), refetchInterval: 15_000 });
  // số thay đổi lệch với danh sách repo (vừa commit/stage…) → quét lại danh sách cho khớp
  const n = st.data?.changes.length;
  useEffect(() => {
    if (n !== undefined && listed !== undefined && n !== listed) void qc.invalidateQueries({ queryKey: ['gitrepos', projectId] });
  }, [n, listed, qc, projectId]);
  // mở từ tóm tắt lượt Claude (`?file=`) → chọn sẵn file đó, mở ô diff trên điện thoại (AC-41)
  const [sel, setSel] = useState<{ path: string; staged: boolean } | null>(focusPath ? { path: focusPath, staged: false } : null);
  const [pane, setPane] = useState(!!focusPath);
  // điện thoại: ô diff là một "trang" → nút back đóng ô thay vì rời Git (dogfood mobile #1)
  useEffect(() => {
    if (!pane || !matchMedia('(max-width: 767px)').matches) return;
    let popped = false;
    window.history.pushState({ hrGitPane: 1 }, '');
    const onPop = () => ((popped = true), setPane(false));
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      if (!popped && window.history.state?.hrGitPane) window.history.back(); // đóng bằng nút ‹ trong app → gỡ mục lịch sử đã đẩy
    };
  }, [pane]);
  const [msg, setMsg] = useState(() => sessionStorage.getItem(`commitmsg:${projectId}:${repo}`) ?? '');
  const [busy, setBusy] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ rect: DOMRect; items: MenuItem[] } | null>(null);
  const [commitSel, setCommitSel] = useState<string | null>(null);

  const g = st.data;
  const changes = g?.changes ?? [];
  const cur = sel ?? (changes[0] ? { path: changes[0].path, staged: changes[0].staged && !changes[0].unstaged } : null);
  const diff = useQuery({ queryKey: ['gitdiff', projectId, repo, cur?.path, cur?.staged, g?.changes.length], queryFn: () => ga.diff(cur!.path, cur!.staged), enabled: !!cur && !history });
  const commits = useInfiniteQuery({
    queryKey: ['gitlog', projectId, repo],
    queryFn: ({ pageParam }) => ga.commits(pageParam),
    initialPageParam: 0,
    getNextPageParam: (p) => p.next ?? undefined,
    enabled: history,
  });
  const allCommits = commits.data?.pages.flatMap((p) => p.commits) ?? [];
  const curCommit = commitSel ?? allCommits[0]?.sha;
  const [commitFile, setCommitFile] = useState<string | null>(null);
  const detail = useQuery({ queryKey: ['gitcommit', projectId, repo, curCommit, commitFile], queryFn: () => ga.commit1(curCommit!, commitFile ?? undefined), enabled: history && !!curCommit });

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
    if (blockedOffline(toast, t('net.offlineTip'))) return;
    if (await run('commit', () => ga.commit(msg.trim()), t('git.committed'))) {
      setMsg('');
      sessionStorage.removeItem(`commitmsg:${projectId}:${repo}`);
      void qc.invalidateQueries({ queryKey: ['gitlog', projectId, repo] });
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
          qc.setQueryData(key, await ga.discard(c.path));
          toast(t('git.discarded'));
        }}
      />,
    );
  const branchMenu = async (e: MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const b = await ga.branches().catch(() => null);
    if (!b) return;
    setMenu({
      rect,
      items: [
        ...b.local.map((n) => ({ group: t('git.localBranches'), icon: 'git' as const, label: n === b.current ? `${n} · ${t('git.current')}` : n, disabled: n === b.current, onSelect: () => void run('checkout', () => ga.checkout(n), t('git.switched', { name: n })) })),
        ...b.remote.map((n) => ({ group: t('git.remoteBranches'), icon: 'git' as const, label: n, onSelect: () => void run('checkout', () => ga.checkout(n), t('git.switched', { name: n })) })),
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
          if (e.key === ' ') (e.preventDefault(), void run('stage', () => (isStaged ? ga.unstage([c.path]) : ga.stage([c.path]))));
        }}
      >
        <span className={`mono xs ${code === 'A' ? 'add' : code === 'D' ? 'del' : 'muted'}`}>{code}</span>
        <span className="ell grow">{disp(c.path)}</span>
        {!c.untracked && (
          <span className="xs">
            <span className="add">+{c.added}</span> <span className="del">−{c.deleted}</span>
          </span>
        )}
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
            void run('stage', () => (isStaged ? ga.unstage([c.path]) : ga.stage([c.path])));
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
      <Button variant="ghost" size="sm" iconOnly icon="refresh" label={t('git.fetch')} loading={busy === 'fetch'} write onClick={() => void run('fetch', () => ga.fetch(), t('git.fetched'))} />
      <Button variant="ghost" size="sm" iconOnly icon="pull" label={t('git.pull')} loading={busy === 'pull'} write onClick={() => void run('pull', () => ga.pull(), t('git.pulled'))} />
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
        onClick={() => void run('push', () => ga.push(), t('git.pushed'))}
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
        {header}
        {branch}
        {tabs}
        {!changes.length ? (
          <EmptyState icon="git" message={t('git.clean')} />
        ) : (
          <>
            <div className="gsec">
              <span className="grow">{t('git.stagedSec', { count: staged.length })}</span>
              {!!staged.length && <Button variant="ghost" size="sm" iconOnly icon="minus" write label={t('git.unstageAll')} onClick={() => void run('stage', () => ga.unstage(['*']))} />}
            </div>
            {staged.map((c) => row(c, true))}
            {!staged.length && <p className="muted xs" style={{ margin: '0 var(--space-md) var(--space-sm)' }}>{t('git.noneStaged')}</p>}
            <div className="gsec">
              <span className="grow">{t('git.unstagedSec', { count: unstaged.length })}</span>
              {!!unstaged.length && <Button variant="ghost" size="sm" iconOnly icon="plus" write label={t('git.stageAll')} onClick={() => void run('stage', () => ga.stage(['*']))} />}
            </div>
            {unstaged.map((c) => row(c, false))}
            <div className="commitbox">
              <textarea
                className="input"
                rows={2}
                placeholder={t('git.msgPh')}
                value={msg}
                onChange={(e) => (setMsg(e.target.value), sessionStorage.setItem(`commitmsg:${projectId}:${repo}`, e.target.value))}
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
          <span className="mono ell grow">
            {repo && <span className="muted">{repo}/</span>}
            {cur.path}
          </span>
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
        {header}
        {branch}
        {tabs}
        {commits.isLoading && <Skeleton rows={5} />}
        {allCommits.map((c) => (
          <div key={c.sha} className={`grow-row ${curCommit === c.sha ? 'sel' : ''}`} style={{ minHeight: 56 }} tabIndex={0} onClick={() => (setCommitSel(c.sha), setCommitFile(null), setPane(true))}>
            <div className="t grow">
              <div className="sm ell">{c.subject}</div>
              <div className="xs muted ell">
                <span className="mono">{c.short}</span> · {c.author} · {new Date(c.date).toLocaleString(i18n.language, { dateStyle: 'short', timeStyle: 'short' })}
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
    right = !commits.isLoading && !allCommits.length ? (
      // repo chưa có commit: không để khung đang tải mãi (dogfood edge V4)
      <div className="special muted">{t('git.noCommits')}</div>
    ) : d ? (
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
      <div className={`git ${pane ? 'open' : ''} ${compact ? 'compact' : ''}`}>
        <aside className="gleft">{left}</aside>
        <section className="pane gright">{right}</section>
      </div>
      {menu && <Menu anchor={menu.rect} items={menu.items} onClose={() => setMenu(null)} />}
    </div>
  );
}
