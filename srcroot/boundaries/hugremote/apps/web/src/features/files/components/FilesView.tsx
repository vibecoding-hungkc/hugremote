import { useQuery, useQueryClient } from '@tanstack/react-query';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Button } from '../../../components/ui/Button';
import { CodeEditor, type CodeEditorHandle } from '../../../components/ui/CodeEditor';
import { ConfirmDialog, RenameDialog, useDialogs } from '../../../components/ui/Dialogs';
import { DiffBlock } from '../../../components/ui/DiffBlock';
import { Icon } from '../../../components/ui/Icon';
import { Menu, toast, type MenuItem } from '../../../components/ui/Overlay';
import { EmptyState, ErrorBox, Skeleton } from '../../../components/ui/States';
import { ApiError } from '../../../lib/api-client';
import { blockedOffline } from '../../../lib/connection';
import { filesApi, type FsEntry } from '../api/files.api';
import { isDirty, useFiles, type OpenFile } from '../files.store';
import { useFilesTree } from '../files-tree.store';
import { useUi } from '../../../stores/ui.store';

const IMG = /\.(png|jpe?g|gif|webp|svg|ico)$/i;
const LOG = /\.(log|out)$|(^|\/)logs?\//i;
const errText = (t: TFunction, e: unknown) => t(`errors.${e instanceof ApiError ? e.code : 'INTERNAL'}`, { defaultValue: t('errors.INTERNAL') });

export interface FilesActions {
  openTerminalAt: (dir: string) => void;
  /** Vòng 3 — AC-59: chỉ có khi chạy trong app desktop. */
  openInBrowser?: (path: string) => void;
  sendToClaude: (path: string, e: MouseEvent<HTMLElement>) => void;
}

/** S8 — Files làm theo việc hằng ngày của developer (PERSONAS §1.1, AC-16/17/36/37). */
export function FilesView({ projectId, rootPath, isHome, path: routePath, line, onRoute, actions, compact }: { projectId: string; rootPath: string; isHome?: boolean; path?: string; line?: number; onRoute: (path?: string, line?: number) => void; actions: FilesActions; compact?: boolean }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const openDialog = useDialogs((s) => s.open);
  const store = useFiles();
  const state = store.byProject[projectId] ?? { open: [] };
  const active = state.open.find((f) => f.path === state.active);
  const [side, setSide] = useState<'tree' | 'search'>('tree');
  const tree = useFilesTree((s) => s.byProject[projectId]);
  const patchTree = useFilesTree((s) => s.patch);
  const hidden = tree?.hidden ?? !!isHome; // AC-61: Home hiện file ẩn sẵn
  const expanded = tree?.expanded ?? {};
  const setHidden = (v: boolean) => patchTree(projectId, { hidden: v });
  // AC-60: giữ vị trí cuộn của cây — lưu khi gỡ, trả lại khi gắn (đợi các thư mục con tải xong một nhịp)
  const treeEl = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = treeEl.current;
    const y = useFilesTree.getState().byProject[projectId]?.scrollTop ?? 0;
    const tm = setTimeout(() => el && (el.scrollTop = y), 150);
    return () => {
      clearTimeout(tm);
      if (el) patchTree(projectId, { scrollTop: el.scrollTop });
    };
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps
  const setExpanded = (fn: (s: Record<string, boolean>) => Record<string, boolean>) => patchTree(projectId, { expanded: fn(useFilesTree.getState().byProject[projectId]?.expanded ?? {}) });
  const [filter, setFilter] = useState('');
  const [wrap, setWrap] = useState(false);
  const [diffMode, setDiffMode] = useState(false);
  const [preview, setPreview] = useState(false);
  const [compare, setCompare] = useState(false);
  const [mobileFile, setMobileFile] = useState(false);
  const [openErr, setOpenErr] = useState<{ path: string; msg: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [menu, setMenu] = useState<{ rect: DOMRect; items: MenuItem[] } | null>(null);
  const [upload, setUpload] = useState<{ done: number; total: number } | null>(null);
  const editor = useRef<CodeEditorHandle>(null);
  const uploadInput = useRef<HTMLInputElement>(null);
  const uploadFolderInput = useRef<HTMLInputElement>(null);
  const uploadDir = useRef('');

  // ----- mở file theo URL (…/files/<path>/<dòng>) -----
  const openPath = async (p: string, ln?: number) => {
    setOpenErr(null);
    const existing = state.open.find((f) => f.path === p);
    if (existing) store.setActive(projectId, p);
    else if (IMG.test(p)) store.open(projectId, { path: p, base: '', buf: '', mtime: 0 });
    else {
      try {
        const r = await filesApi.read(projectId, p, LOG.test(p) ? 256 * 1024 : undefined);
        if (r.binary) {
          toast(t('files.binary'));
          return;
        }
        store.open(projectId, { path: p, base: r.content, buf: r.content, mtime: r.mtime });
      } catch (e) {
        if (e instanceof ApiError && e.code === 'FILE_TOO_LARGE') store.open(projectId, { path: p, base: '', buf: '', mtime: -1 });
        else {
          const msg = errText(t, e);
          setOpenErr({ path: p, msg });
          setMobileFile(true);
          return toast(msg);
        }
      }
    }
    setMobileFile(true);
    setDiffMode(false);
    if (ln) setTimeout(() => editor.current?.goto(ln), 60);
  };
  useEffect(() => {
    if (routePath && routePath !== state.active) void openPath(routePath, line);
    else if (routePath && line) editor.current?.goto(line);
  }, [routePath, line]); // eslint-disable-line react-hooks/exhaustive-deps
  const go = (p?: string, ln?: number) => {
    if (p && p === state.active) {
      setOpenErr(null);
      setMobileFile(true);
    }
    onRoute(p, ln);
  };

  // ----- cây -----
  const fileList = useQuery({ queryKey: ['fsfiles', projectId], queryFn: () => filesApi.files(projectId), enabled: !!filter, staleTime: 30_000 });
  const filtered = useMemo(() => (filter ? (fileList.data?.files ?? []).filter((f) => f.toLowerCase().includes(filter.toLowerCase()) && (hidden || !f.split('/').some((s) => s.startsWith('.')))).slice(0, 300) : []), [filter, fileList.data, hidden]);

  // ----- vạch dòng đổi so với commit -----
  const changes = useQuery({ queryKey: ['linechanges', projectId, active?.path, active?.mtime], queryFn: () => filesApi.lineChanges(projectId, active!.path), enabled: !!active && active.mtime > 0 });
  const fileDiff = useQuery({ queryKey: ['filediff', projectId, active?.path, active?.mtime], queryFn: () => filesApi.gitDiff(projectId, active!.path), enabled: diffMode && !!active });

  const save = async (f: OpenFile | undefined = active, force = false) => {
    if (!f || (!isDirty(f) && !force) || savingRef.current) return;
    if (blockedOffline(toast, t('net.offlineTip'))) return; // bản sửa giữ nguyên trong store
    savingRef.current = true;
    setSaving(true);
    try {
      const r = await filesApi.write(projectId, f.path, f.buf, force ? f.conflictMtime : f.mtime);
      store.saved(projectId, f.path, r.mtime, f.buf);
      void qc.invalidateQueries({ queryKey: ['git', projectId] });
      void qc.invalidateQueries({ queryKey: ['fs', projectId] });
      toast(t('files.saved', { name: f.path.split('/').pop() }));
    } catch (e) {
      if (e instanceof ApiError && e.code === 'FILE_CHANGED') store.conflict(projectId, f.path, Number(e.details?.mtime));
      else toast(errText(t, e));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };
  const close = (f: OpenFile) => {
    const doClose = () => {
      store.close(projectId, f.path);
      if (state.active === f.path) go(undefined);
    };
    if (!isDirty(f)) return doClose();
    openDialog(
      <ConfirmDialog
        title={t('files.unsavedTitle', { name: f.path.split('/').pop() })}
        body={<p>{t('files.unsavedBody')}</p>}
        confirmLabel={t('files.saveAndClose')}
        onConfirm={async () => {
          await save(f);
          doClose();
        }}
      />,
    );
  };
  const takeDisk = async (f: OpenFile) => {
    const r = await filesApi.read(projectId, f.path);
    store.reload(projectId, f.path, r.content, r.mtime);
    setCompare(false);
    toast(t('files.tookDisk'));
  };

  // ⌘⇧F từ bất kỳ đâu → mở tab Tìm (AC-36)
  const searchAt = useUi((s) => s.filesSearchAt);
  useEffect(() => {
    if (!searchAt || compact) return;
    setSide('search');
    useUi.getState().set({ filesSearchAt: 0 });
  }, [searchAt, compact]);

  // ⌘S / ⌘F / ⌥W ở mức trang
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 's') (e.preventDefault(), void save());
      if (e.altKey && e.code === 'KeyW' && active) (e.preventDefault(), close(active));
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  });

  const relDir = (p: string, type: 'dir' | 'file' | 'link') => (type === 'dir' ? p : p.split('/').slice(0, -1).join('/'));
  const abs = (p: string) => (p ? `${rootPath}/${p}` : rootPath);
  const copy = (s: string) => void navigator.clipboard?.writeText(s).then(() => toast(t('files.copied', { path: s })));
  const refreshDir = (dir: string) => void qc.invalidateQueries({ queryKey: ['fs', projectId, dir] });
  const askName = (title: string, initial: string, run: (v: string) => Promise<unknown>) => openDialog(<RenameDialog title={title} initial={initial} onSave={run} />);

  const fileMenu = (e: MouseEvent<HTMLElement>, x: { path: string; type: 'dir' | 'file' | 'link'; git?: string }) => {
    e.preventDefault();
    e.stopPropagation();
    const name = x.path.split('/').pop() || rootPath;
    const dir = relDir(x.path, x.type);
    const parent = x.path.split('/').slice(0, -1).join('/');
    const create = (kind: 'touch' | 'mkdir') =>
      askName(kind === 'touch' ? t('files.newFile') : t('files.newFolder'), '', async (v) => {
        const p = dir ? `${dir}/${v}` : v;
        await filesApi.action(projectId, kind, p);
        refreshDir(dir);
        setExpanded((s) => ({ ...s, [dir]: true }));
        if (kind === 'touch') go(p);
      });
    const items: MenuItem[] =
      x.type === 'dir'
        ? [
            { icon: 'fileplus', label: t('files.newFile'), onSelect: () => create('touch') },
            { icon: 'folderplus', label: t('files.newFolder'), onSelect: () => create('mkdir') },
            { icon: 'upload', label: t('files.uploadHere'), onSelect: () => ((uploadDir.current = dir), uploadInput.current?.click()) },
            { icon: 'folderplus', label: t('files.uploadFolderHere'), onSelect: () => ((uploadDir.current = dir), uploadFolderInput.current?.click()) },
            ...(x.path
              ? [
                  { icon: 'download' as const, label: t('files.downloadZip'), onSelect: () => void download(x.path, name + '.zip') },
                  { icon: 'term' as const, label: t('files.terminalHere'), onSelect: () => actions.openTerminalAt(x.path) },
                  { icon: 'claude' as const, label: t('files.sendDirToClaude'), onSelect: () => actions.sendToClaude(x.path + '/', e) },
                  { icon: 'copy' as const, label: t('files.copyPath'), onSelect: () => copy(abs(x.path)) },
                  { icon: 'edit' as const, label: t('files.rename'), onSelect: () => askName(t('files.rename'), x.path, async (v) => (await filesApi.action(projectId, 'rename', x.path, v), refreshDir(parent), refreshDir(relDir(v, 'file')))) },
                  { icon: 'trash' as const, label: t('files.deleteDir'), danger: true, onSelect: () => confirmDelete(x.path, parent) },
                ]
              : []),
          ]
        : [
            { icon: 'file', label: t('files.open'), onSelect: () => go(x.path) },
            ...(actions.openInBrowser ? [{ icon: 'globe' as const, label: t('files.openInBrowser'), onSelect: () => actions.openInBrowser!(x.path) }] : []),
            { icon: 'claude', label: t('files.sendToClaude'), onSelect: () => actions.sendToClaude(x.path, e) },
            { icon: 'term', label: t('files.terminalAtDir'), onSelect: () => actions.openTerminalAt(parent) },
            { icon: 'copy', label: t('files.copyPath'), kbd: '⌥⌘C', onSelect: () => copy(abs(x.path)) },
            { icon: 'copy', label: t('files.copyRelPath'), kbd: '⇧⌥⌘C', onSelect: () => copy(x.path) },
            ...(x.git ? [{ icon: 'git' as const, label: t('files.viewChanges'), onSelect: () => (go(x.path), setDiffMode(true)) }] : []),
            { icon: 'edit', label: t('files.renameMove'), onSelect: () => askName(t('files.renameMove'), x.path, async (v) => (await filesApi.action(projectId, 'rename', x.path, v), store.rename(projectId, x.path, v), refreshDir(parent), refreshDir(relDir(v, 'file')))) },
            { icon: 'plus', label: t('files.duplicate'), onSelect: () => void dup(x.path, parent) },
            { icon: 'download', label: t('files.download'), onSelect: () => void download(x.path, name) },
            ...(x.git
              ? [{ icon: 'undo' as const, label: t('git.discardTip'), danger: true, onSelect: () => openDialog(<ConfirmDialog danger title={t('git.discardTitle', { name })} body={<p>{t('git.discardBody')}</p>} confirmLabel={t('git.discard')} onConfirm={async () => (await filesApi.gitDiscard(projectId, x.path), refreshDir(parent), store.close(projectId, x.path))} />) }]
              : []),
            { icon: 'trash', label: t('files.delete'), danger: true, onSelect: () => confirmDelete(x.path, parent) },
          ];
    setMenu({ rect: (e.currentTarget as HTMLElement).getBoundingClientRect(), items });
  };
  const confirmDelete = (p: string, parent: string) =>
    openDialog(
      <ConfirmDialog
        danger
        title={t('files.deleteTitle', { name: p.split('/').pop() })}
        body={<p>{t('files.deleteBody')}</p>}
        confirmLabel={t('files.delete')}
        onConfirm={async () => {
          await filesApi.action(projectId, 'delete', p);
          store.close(projectId, p);
          refreshDir(parent);
          toast(t('files.deleted', { name: p.split('/').pop() }));
        }}
      />,
    );
  const dup = async (p: string, parent: string) => {
    const m = /^(.*?)(\.[^./]*)?$/.exec(p)!;
    const to = `${m[1]} copy${m[2] ?? ''}`;
    try {
      await filesApi.action(projectId, 'copy', p, to);
      refreshDir(parent);
      toast(t('files.duplicated', { name: to.split('/').pop() }));
    } catch (e) {
      toast(errText(t, e));
    }
  };
  const download = async (p: string, name: string) => {
    toast(t('files.downloading', { name }));
    const r = await filesApi.download(projectId, p);
    const url = URL.createObjectURL(await r.blob());
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };
  const doUpload = async (list: FileList | null) => {
    if (!list?.length) return;
    const files = Array.from(list).map((file) => ({ file, path: (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name }));
    setUpload({ done: 0, total: files.length });
    try {
      for (let i = 0; i < files.length; i += 20) {
        await filesApi.upload(projectId, uploadDir.current, files.slice(i, i + 20));
        setUpload({ done: Math.min(files.length, i + 20), total: files.length });
      }
      refreshDir(uploadDir.current);
      toast(t('files.uploaded', { count: files.length }));
    } catch (e) {
      toast(errText(t, e));
    } finally {
      setUpload(null);
      if (uploadInput.current) uploadInput.current.value = '';
      if (uploadFolderInput.current) uploadFolderInput.current.value = '';
    }
  };

  // ----- thân editor -----
  const body = () => {
    if (openErr)
      return (
        <div className="special">
          <ErrorBox title={openErr.msg} body={<span className="mono xs">{openErr.path}</span>} onRetry={() => void openPath(openErr.path, line)} />
        </div>
      );
    if (!active) return <div className="special"><EmptyState icon="file" message={t('files.noneOpen')} /></div>;
    if (IMG.test(active.path))
      return (
        <div className="special">
          <ImageView projectId={projectId} path={active.path} />
          <div className="sm">{active.path.split('/').pop()}</div>
          <Button variant="ghost" size="sm" iconOnly icon="download" label={t('files.download')} onClick={() => void download(active.path, active.path.split('/').pop()!)} />
        </div>
      );
    if (active.mtime === -1)
      return (
        <div className="special">
          <p className="muted" style={{ margin: 0 }}>{t('files.tooLarge')}</p>
          <div className="btns" style={{ justifyContent: 'center' }}>
            <Button size="sm" onClick={async () => { const r = await filesApi.read(projectId, active.path, 200 * 1024); store.reload(projectId, active.path, r.content, 0); }}>{t('files.tail1000')}</Button>
            <Button size="sm" icon="download" onClick={() => void download(active.path, active.path.split('/').pop()!)}>{t('files.download')}</Button>
          </div>
        </div>
      );
    if (compare && active.conflictMtime) return <CompareView projectId={projectId} file={active} />;
    if (diffMode) return fileDiff.isLoading ? <Skeleton rows={4} /> : <DiffBlock diff={fileDiff.data?.diff ?? ''} />;
    if (LOG.test(active.path)) return <LogView projectId={projectId} file={active} />;
    if (/\.md$/i.test(active.path) && preview) return <div className="preview" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(marked.parse(active.buf, { async: false })) }} />;
    return (
      <CodeEditor
        ref={editor}
        name={active.path}
        value={active.buf}
        wrap={wrap}
        changes={changes.data}
        label={t('files.contentOf', { path: active.path })}
        onChange={(v) => store.edit(projectId, active.path, v)}
        onSave={() => void save()}
      />
    );
  };

  const editable = !!active && !IMG.test(active.path) && active.mtime !== -1 && !LOG.test(active.path);
  const dirty = isDirty(active);
  const name = active?.path.split('/').pop();
  const dir = active ? abs(active.path.split('/').slice(0, -1).join('/')) : '';

  return (
    <div className="content flush" data-screen="S8" aria-label="Files">
      <input ref={uploadInput} type="file" multiple hidden onChange={(e) => void doUpload(e.target.files)} />
      {/* cả thư mục (giữ cấu trúc con qua webkitRelativePath) — dogfood smoke #14 */}
      <input
        ref={(el) => {
          uploadFolderInput.current = el;
          el?.setAttribute('webkitdirectory', '');
        }}
        type="file"
        multiple
        hidden
        onChange={(e) => void doUpload(e.target.files)}
      />
      <div className={`files ${mobileFile && active ? 'open' : ''} ${compact ? 'compact' : ''}`}>
        <aside className="ftree" ref={treeEl}>
          <div className="ftool">
            <div className="seg grow">
              <button className={side === 'tree' ? 'on' : ''} onClick={() => setSide('tree')}>
                <Icon name="folder" />
                {t('files.tree')}
              </button>
              <button className={side === 'search' ? 'on' : ''} title={`${t('files.searchProject')} (⌘⇧F)`} onClick={() => setSide('search')}>
                <Icon name="search" />
                {t('files.search')}
              </button>
            </div>
            <Button variant="ghost" size="sm" iconOnly icon="fileplus" write label={t('files.newFileOrFolder')} onClick={(e) => fileMenu(e, { path: '', type: 'dir' })} />
            <Button variant="ghost" size="sm" iconOnly icon="upload" write label={t('files.upload')} onClick={() => ((uploadDir.current = ''), uploadInput.current?.click())} />
            <Button variant="ghost" size="sm" iconOnly icon="eye" tone={hidden ? 'primary' : undefined} label={t(hidden ? 'files.hideHidden' : 'files.showHidden')} onClick={() => setHidden(!hidden)} />
          </div>
          {side === 'search' ? (
            <SearchSide projectId={projectId} hidden={hidden} onOpen={(p, l) => go(p, l)} />
          ) : (
            <>
              <div className="fside">
                <input className="input" placeholder={t('files.filterPh')} value={filter} onChange={(e) => setFilter(e.target.value)} aria-label={t('files.filterPh')} />
              </div>
              {upload && (
                <div className="xs" style={{ padding: 'var(--space-sm) var(--space-md)', display: 'grid', gap: 'var(--space-xs)' }}>
                  <span>{t('files.uploading', { done: upload.done, total: upload.total })}</span>
                  <div className="prog">
                    <i style={{ width: `${Math.round((upload.done / upload.total) * 100)}%` }} />
                  </div>
                </div>
              )}
              <div className="legend">{t('files.legend')}</div>
              {filter ? (
                filtered.map((p) => (
                  <div key={p} className={`node ${state.active === p ? 'sel' : ''}`} tabIndex={0} onClick={() => go(p)} onKeyDown={(e) => e.key === 'Enter' && go(p)} onContextMenu={(e) => fileMenu(e, { path: p, type: 'file' })}>
                    <Icon name="file" />
                    <span className="nm">{p}</span>
                  </div>
                ))
              ) : (
                <Dir projectId={projectId} path="" depth={0} hidden={hidden} expanded={expanded} toggle={(p) => setExpanded((s) => ({ ...s, [p]: !s[p] }))} activePath={state.active} onOpen={(p) => go(p)} onMenu={fileMenu} />
              )}
            </>
          )}
        </aside>
        <section className="editor">
          {!!state.open.length && (
            <div className="tabbar">
              <div className="tabs">
                {state.open.map((f) => (
                  <div key={f.path} className={`tab ${f.path === state.active ? 'on' : ''}`} tabIndex={0} title={f.path} onClick={() => go(f.path)}>
                    <span className="tn">{f.path.split('/').pop()}</span>
                    {isDirty(f) && <span className="dot warn" title={t('files.unsaved')} />}
                    <Button variant="ghost" size="sm" iconOnly icon="x" label={`${t('common.close')} ${f.path.split('/').pop()} (⌥W)`} onClick={(e) => (e.stopPropagation(), close(f))} />
                  </div>
                ))}
              </div>
            </div>
          )}
          {active && (
            <div className="ehead">
              <span className="only-mobile">
                <Button variant="ghost" size="sm" iconOnly icon="back" label={t('files.backToList')} onClick={() => setMobileFile(false)} />
              </span>
              <span className="fname">{name}</span>
              <span className="fdir" title={`${abs(active.path)} — ${t('files.clickToCopy')}`} onClick={() => copy(abs(active.path))}>
                &lrm;{dir}&lrm;
              </span>
              {editable && !diffMode && (
                <>
                  <Button variant="ghost" size="sm" iconOnly icon="search" label={`${t('files.findReplace')} (⌘F)`} onClick={() => editor.current?.openFind()} />
                  <Button variant="ghost" size="sm" iconOnly icon="wrapi" tone={wrap ? 'primary' : undefined} label={t(wrap ? 'files.wrapOff' : 'files.wrapOn')} onClick={() => setWrap(!wrap)} />
                </>
              )}
              {/\.md$/i.test(active.path) && <Button variant="ghost" size="sm" iconOnly icon={preview ? 'edit' : 'eye'} label={t(preview ? 'files.edit' : 'files.preview')} onClick={() => setPreview(!preview)} />}
              {(changes.data?.added.length || changes.data?.modified.length || diffMode) && (
                <Button variant="ghost" size="sm" iconOnly icon="git" tone={diffMode ? 'primary' : undefined} label={t(diffMode ? 'files.backToEdit' : 'files.viewChanges')} onClick={() => setDiffMode(!diffMode)} />
              )}
              <Button variant="ghost" size="sm" iconOnly icon="more" label={t('files.more')} onClick={(e) => fileMenu(e, { path: active.path, type: 'file', git: changes.data?.added.length || changes.data?.modified.length ? 'M' : undefined })} />
              {editable && <Button variant={dirty ? 'primary' : 'ghost'} size="sm" iconOnly icon="save" write loading={saving} label={`${t('common.save')} (⌘S)`} onClick={() => void save()} />}
            </div>
          )}
          {active?.claudeTouched && !active.conflictMtime && (
            <div className="notice">
              <Icon name="claude" className="claude-ic" />
              <span className="grow">{t('files.claudeEdited')}</span>
              <Button variant="ghost" size="sm" onClick={() => setDiffMode(true)}>
                {t('files.viewChanges')}
              </Button>
              <Button variant="ghost" size="sm" iconOnly icon="x" label={t('common.close')} onClick={() => store.touched(projectId, active.path, false)} />
            </div>
          )}
          {active?.conflictMtime && (
            <div className="notice danger">
              <Icon name="warn" className="warn-ic" />
              <span className="grow">{t('files.conflict')}</span>
              <Button variant="ghost" size="sm" tone={compare ? 'primary' : undefined} onClick={() => setCompare(!compare)}>
                {compare ? t('files.closeCompare') : t('files.compare')}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => void takeDisk(active)}>
                {t('files.takeDisk')}
              </Button>
              <Button variant="ghost" size="sm" tone="danger" write onClick={() => void save(active, true).then(() => setCompare(false))}>
                {t('files.keepMine')}
              </Button>
            </div>
          )}
          <div className="panes">
            <div className="pane">{body()}</div>
          </div>
          {editable && !diffMode && !preview && (
            <div className="edkeys" aria-label={t('term.keybar')}>
              {(['Tab', '{', '}', '(', ')', '[', ']', "'", '"', ';', '/', '=', '=>'] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  className="key"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => editor.current?.insert(k === 'Tab' ? '  ' : k)}
                >
                  {k}
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
      {menu && <Menu anchor={menu.rect} items={menu.items} onClose={() => setMenu(null)} />}
    </div>
  );
}

/** C31 — ảnh: tải qua api (có access token) rồi hiện bằng object URL. */
function ImageView({ projectId, path }: { projectId: string; path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let u: string | null = null;
    void filesApi.raw(projectId, path).then(async (r) => {
      u = URL.createObjectURL(await r.blob());
      setUrl(u);
    });
    return () => {
      if (u) URL.revokeObjectURL(u);
    };
  }, [projectId, path]);
  return url ? <img style={{ maxWidth: '100%', maxHeight: '60vh', objectFit: 'contain', background: 'var(--color-surface-raised)', borderRadius: 'var(--radius)' }} alt={path} src={url} /> : <Skeleton rows={1} />;
}

/** Một cấp thư mục, tải khi mở (lazy). */
function Dir({ projectId, path, depth, hidden, expanded, toggle, activePath, onOpen, onMenu }: { projectId: string; path: string; depth: number; hidden: boolean; expanded: Record<string, boolean>; toggle: (p: string) => void; activePath?: string; onOpen: (p: string) => void; onMenu: (e: MouseEvent<HTMLElement>, x: FsEntry) => void }) {
  const { t } = useTranslation();
  const q = useQuery({ queryKey: ['fs', projectId, path, hidden], queryFn: () => filesApi.list(projectId, path, hidden) });
  if (q.isLoading) return depth === 0 ? <Skeleton rows={5} /> : null;
  if (q.isError) return <div style={{ padding: 'var(--space-md)' }}><ErrorBox title={errText(t, q.error)} onRetry={() => void q.refetch()} /></div>;
  if (depth === 0 && !q.data?.entries.length) return <EmptyState icon="file" message={t('files.emptyDir')} />;
  return (
    <>
      {q.data!.entries.map((x) => (
        <div key={x.path}>
          <div
            className={`node ${x.ignored ? 'ign' : ''} ${activePath === x.path ? 'sel' : ''}`}
            style={{ paddingLeft: `calc(var(--space-md) + ${depth} * var(--space-lg))` }}
            tabIndex={0}
            onClick={() => (x.type === 'dir' ? toggle(x.path) : onOpen(x.path))}
            onKeyDown={(e) => e.key === 'Enter' && (x.type === 'dir' ? toggle(x.path) : onOpen(x.path))}
            onContextMenu={(e) => onMenu(e, x)}
          >
            {x.type === 'dir' && <Icon name="chev" className={`chev ${expanded[x.path] ? 'open' : ''}`} />}
            <Icon name={x.type === 'dir' ? 'folder' : 'file'} />
            <span className="nm">{x.name}</span>
            {x.git && x.type !== 'dir' && (
              <span className={`meta ${x.git === 'A' || x.git === '?' ? 'add' : ''}`} title={x.git === '?' || x.git === 'A' ? t('files.newMark') : t('files.modMark')}>
                {x.git === '?' ? 'A' : x.git}
              </span>
            )}
            <Button variant="ghost" size="sm" iconOnly icon="more" className="act" label={t('files.actionsFor', { name: x.name })} onClick={(e) => onMenu(e, x)} />
          </div>
          {x.type === 'dir' && expanded[x.path] && <Dir projectId={projectId} path={x.path} depth={depth + 1} hidden={hidden} expanded={expanded} toggle={toggle} activePath={activePath} onOpen={onOpen} onMenu={onMenu} />}
        </div>
      ))}
    </>
  );
}

/** C29 — tìm trong dự án (⌘⇧F): ≥2 ký tự, Aa / .* , nhóm theo file, bấm mở đúng dòng. */
function SearchSide({ projectId, hidden, onOpen }: { projectId: string; hidden: boolean; onOpen: (p: string, l: number) => void }) {
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const [deb, setDeb] = useState('');
  const [cs, setCs] = useState(false);
  const [rx, setRx] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setDeb(q), 300);
    return () => clearTimeout(id);
  }, [q]);
  let reOk = true;
  if (rx && deb)
    try {
      new RegExp(deb);
    } catch {
      reOk = false;
    }
  const r = useQuery({ queryKey: ['search', projectId, deb, cs, rx, hidden], queryFn: () => filesApi.search(projectId, deb, { case: cs, regex: rx, hidden }), enabled: deb.length >= 2 && reOk });
  const groups = useMemo(() => {
    const m = new Map<string, { line: number; text: string }[]>();
    for (const h of r.data?.results ?? []) m.set(h.path, [...(m.get(h.path) ?? []), h]);
    return [...m.entries()];
  }, [r.data]);
  const mark = (s: string) => {
    if (!deb) return s;
    const re = new RegExp(rx ? deb : deb.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), cs ? 'g' : 'gi');
    const parts: React.ReactNode[] = [];
    let last = 0;
    for (const m of s.matchAll(re)) {
      if (!m[0]) break;
      parts.push(s.slice(last, m.index), <mark key={m.index}>{m[0]}</mark>);
      last = m.index! + m[0].length;
    }
    parts.push(s.slice(last));
    return parts;
  };
  return (
    <>
      <div className="fside">
        <input className="input" autoFocus placeholder={`${t('files.searchProject')}… (⌘⇧F)`} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t('files.searchProject')} />
        <div className="btns">
          <button className={`chip ${cs ? 'warn' : ''}`} title={t('files.caseSensitive')} aria-pressed={cs} onClick={() => setCs(!cs)}>
            Aa
          </button>
          <button className={`chip ${rx ? 'warn' : ''}`} title={t('files.regex')} aria-pressed={rx} onClick={() => setRx(!rx)}>
            .*
          </button>
        </div>
      </div>
      {q.length < 2 ? (
        <p className="muted xs" style={{ padding: '0 var(--space-md)' }}>{t('files.searchHint')}</p>
      ) : !reOk ? (
        <p className="msg xs" style={{ padding: '0 var(--space-md)' }}>{t('files.badRegex')}</p>
      ) : r.isLoading || q !== deb ? (
        <Skeleton rows={3} />
      ) : !groups.length ? (
        <EmptyState icon="search" message={t('files.noResults', { q: deb })} />
      ) : (
        <div className="sres">
          <div className="legend">
            {t('files.resultsCount', { count: r.data!.results.length, files: groups.length })}
            {r.data!.truncated ? ` — ${t('files.truncated')}` : ''}
          </div>
          {groups.map(([p, hits]) => (
            <div key={p}>
              <div className="sf">
                <Icon name="file" />
                <span className="ell">{p}</span>
                <span className="badge">{hits.length}</span>
              </div>
              {hits.map((h) => (
                <div key={h.line} className="sl" tabIndex={0} onClick={() => onOpen(p, h.line)} onKeyDown={(e) => e.key === 'Enter' && onOpen(p, h.line)}>
                  <span className="n">{h.line}</span>
                  <span className="ell">{mark(h.text.trim())}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/** C31 — log: lọc chữ + mức, theo dõi (đọc lại đoạn cuối mỗi 2s). */
function LogView({ projectId, file }: { projectId: string; file: OpenFile }) {
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const [lvl, setLvl] = useState<'all' | 'ERROR' | 'WARN'>('all');
  const [follow, setFollow] = useState(true);
  const r = useQuery({ queryKey: ['tail', projectId, file.path], queryFn: () => filesApi.read(projectId, file.path, 256 * 1024), refetchInterval: follow ? 2000 : false, initialData: { path: file.path, content: file.buf, mtime: file.mtime, size: file.buf.length, binary: false, truncated: false } });
  const lines = r.data.content.split('\n');
  const shown = lines.filter((l) => (lvl === 'all' || l.includes(lvl)) && (!q || l.toLowerCase().includes(q.toLowerCase())));
  const pre = useRef<HTMLPreElement>(null);
  useEffect(() => {
    if (follow && pre.current) pre.current.scrollTop = pre.current.scrollHeight;
  }, [r.data, follow]);
  return (
    <>
      <div className="findbar">
        <input className="input" placeholder={t('files.logFilter')} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t('files.logFilter')} />
        <div className="seg">
          {(['all', 'ERROR', 'WARN'] as const).map((l) => (
            <button key={l} className={lvl === l ? 'on' : ''} onClick={() => setLvl(l)}>
              {l === 'all' ? t('files.all') : l}
            </button>
          ))}
        </div>
        <span className="xs muted grow">{t('files.logCount', { shown: shown.length, total: lines.length })}</span>
        <Button variant="ghost" size="sm" iconOnly icon="refresh" tone={follow ? 'primary' : undefined} label={t(follow ? 'files.following' : 'files.follow')} onClick={() => setFollow(!follow)} />
      </div>
      <pre ref={pre} className="term" style={{ flex: 1, overflow: 'auto', margin: 0 }}>
        {shown.map((l, i) => (
          <div key={i} className={l.includes('ERROR') ? 'r' : l.includes('WARN') ? 'y' : ''}>
            {l || ' '}
          </div>
        ))}
      </pre>
    </>
  );
}

/** So sánh bản của tôi (chưa lưu) với bản trên máy khi xung đột (AC-37). */
function CompareView({ projectId, file }: { projectId: string; file: OpenFile }) {
  const { t } = useTranslation();
  const disk = useQuery({ queryKey: ['disk', projectId, file.path, file.conflictMtime], queryFn: () => filesApi.read(projectId, file.path) });
  const mine = file.buf.split('\n');
  const theirs = (disk.data?.content ?? '').split('\n');
  return (
    <div className="cmp">
      <div>
        <div className="pane-head">{t('files.mine')}</div>
        <pre>{mine.map((l, i) => <div key={i} className={l !== theirs[i] ? 'x' : ''}>{l || ' '}</div>)}</pre>
      </div>
      <div>
        <div className="pane-head">{t('files.disk')}</div>
        <pre>{disk.isLoading ? '…' : theirs.map((l, i) => <div key={i} className={l !== mine[i] ? 'x' : ''}>{l || ' '}</div>)}</pre>
      </div>
    </div>
  );
}
