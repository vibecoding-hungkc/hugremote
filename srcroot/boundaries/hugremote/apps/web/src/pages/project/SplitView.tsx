import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useNewSession } from '../../app/shell/actions';
import { pbase, useSessions } from '../../app/shell/sessions';
import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/ui/Icon';
import { EmptyState } from '../../components/ui/States';
import { FilesView } from '../../features/files/components/FilesView';
import { useFiles } from '../../features/files/files.store';
import { GitView } from '../../features/git/components/GitView';
import { TerminalPane } from '../../features/terminal/components/TerminalPane';
import { workspaceApi } from '../../features/workspace/api/workspace.api';
import { qk, useProject } from '../../features/workspace/hooks/useWorkspace';
import { ApiError } from '../../lib/api-client';
import { toast } from '../../components/ui/Overlay';
import { useUi } from '../../stores/ui.store';
import { ClaudePage } from './ClaudePage';

/**
 * AC-35 / AC-10 — vùng chính chia ô trái/phải trên desktop: ô trái là phiên đang xem, ô phải chọn Claude · Terminal ·
 * Files · Git; kéo thanh giữa đổi tỉ lệ (lưu cho người xem). Dưới 768px chỉ còn ô trái (CSS ẩn ô phải).
 */
export function SplitView({ hostId, projectId, currentId, children }: { hostId: string; projectId: string; currentId: string; children: ReactNode }) {
  const { t } = useTranslation();
  const nav = useNavigate();
  const qc = useQueryClient();
  const split = useUi((s) => s.split);
  const ratio = useUi((s) => s.ratio);
  const set = useUi((s) => s.set);
  const box = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState(false);
  const list = (useSessions().byProject.get(projectId) ?? []).filter((s) => s.id !== currentId);
  const project = useProject(projectId).data;
  const newSession = useNewSession();
  const active = useFiles((s) => s.byProject[projectId]?.active);
  const [filePos, setFilePos] = useState<{ path?: string; line?: number }>({});

  if (!split) return <div className="panes">{children}</div>;

  // phiên mới tạo từ ô phải thì mở ngay trong ô phải, ô chính giữ nguyên
  const newHere = async (kind: 'terminal' | 'claude') => {
    if (kind === 'claude') return void newSession('claude', hostId, projectId);
    try {
      const term = await workspaceApi.createTerminal(projectId, {});
      await qc.invalidateQueries({ queryKey: qk.terminals });
      set({ split: { kind: 'terminal', id: term.id } });
    } catch (e) {
      toast(t(`errors.${e instanceof ApiError ? e.code : 'INTERNAL'}`, { defaultValue: t('errors.INTERNAL') }));
    }
  };

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    const el = box.current;
    if (!el) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag(true);
    const r = el.getBoundingClientRect();
    const move = (ev: globalThis.PointerEvent) => set({ ratio: Math.min(80, Math.max(20, Math.round(((ev.clientX - r.left) / r.width) * 100))) });
    const up = () => {
      setDrag(false);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  const close = <Button variant="ghost" size="sm" iconOnly icon="x" label={t('split.close')} onClick={() => set({ split: null })} />;
  const kindList = list.filter((s) => s.kind === split.kind);
  const cur = kindList.find((s) => s.id === split.id) ?? kindList.find((s) => s.status === 'running' || s.status === 'awaiting') ?? kindList[0];
  const pick = (
    <select aria-label={t('split.pick')} value={cur?.id} onChange={(e) => set({ split: { ...split, id: e.target.value } })}>
      {kindList.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
    </select>
  );

  let right: ReactNode;
  if (split.kind === 'terminal' || split.kind === 'claude') {
    const isClaude = split.kind === 'claude';
    right = (
      <>
        <div className="pane-head">
          <Icon name={isClaude ? 'claude' : 'term'} className={isClaude ? 'claude-ic' : 'term-ic'} />
          {cur ? pick : <span>{isClaude ? 'Claude' : 'Terminal'}</span>}
          <span className="grow" />
          {close}
        </div>
        {!cur ? (
          <div className="content">
            <EmptyState
              icon={isClaude ? 'claude' : 'term'}
              message={isClaude ? t('split.noClaude') : t('split.noTerminal')}
              action={
                <Button size="sm" icon="plus" write={!isClaude} onClick={() => void newHere(split.kind as 'terminal' | 'claude')}>
                  {isClaude ? t('session.newClaude') : t('session.newTerminal')}
                </Button>
              }
            />
          </div>
        ) : isClaude ? (
          <ClaudePage key={cur.id} embed={{ hostId, projectId, sid: cur.id }} />
        ) : (
          <TerminalPane key={cur.id} sessionId={cur.id} exited={cur.status === 'exited'} tmuxName={cur.tmux} onClose={() => set({ split: null })} />
        )}
      </>
    );
  } else if (split.kind === 'files') {
    const path = filePos.path ?? active;
    right = (
      <>
        <div className="pane-head">
          <Icon name="file" />
          <span className="grow ell mono">{path ?? 'Files'}</span>
          {path && (
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              icon="file"
              label={t('split.openInFiles')}
              onClick={() => nav(`${pbase(hostId, projectId)}/files/${path.split('/').map(encodeURIComponent).join('/')}`)}
            />
          )}
          {close}
        </div>
        {project && (
          <FilesView
            projectId={projectId}
            compact
            rootPath={project.rootPath}
            path={path}
            line={filePos.line}
            onRoute={(p, l) => setFilePos({ path: p, line: l })}
            actions={{
              openTerminalAt: (dir) => void newSession('terminal', hostId, projectId, { cwd: dir || undefined }),
              sendToClaude: (p) => nav(`${pbase(hostId, projectId)}/claude/new?attach=${encodeURIComponent(p)}`),
            }}
          />
        )}
      </>
    );
  } else {
    right = (
      <>
        <div className="pane-head">
          <Icon name="git" className="git-ic" />
          <span className="grow">Git</span>
          {close}
        </div>
        <GitView
          projectId={projectId}
          compact
          history={false}
          onHistory={() => nav(`${pbase(hostId, projectId)}/git/history`)}
          onOpenFile={(p) => nav(`${pbase(hostId, projectId)}/files/${p.split('/').map(encodeURIComponent).join('/')}`)}
        />
      </>
    );
  }

  return (
    <div className="panes" ref={box}>
      <div style={{ flex: ratio, display: 'flex', minWidth: 0 }}>{children}</div>
      <div className={`splitter ${drag ? 'drag' : ''}`} role="separator" aria-orientation="vertical" title={t('split.drag')} onPointerDown={onDown} />
      <div className="pane second" style={{ flex: 100 - ratio }}>
        {right}
      </div>
    </div>
  );
}
