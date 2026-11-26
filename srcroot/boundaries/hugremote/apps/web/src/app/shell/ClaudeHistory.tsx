import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog, useDialogs } from '../../components/ui/Dialogs';
import { Icon } from '../../components/ui/Icon';
import { Menu, toast } from '../../components/ui/Overlay';
import { claudeApi } from '../../features/claude/api/claude.api';
import { ck, useClaudeSessions } from '../../features/claude/hooks/useClaude';
import { ApiError } from '../../lib/api-client';
import { pbase } from './sessions';

/** Lịch sử chat Claude CLI của thư mục dự án (cạnh chuông): bấm dòng = tiếp tục phiên, 🗑 = xoá khỏi lịch sử. */
export function ClaudeHistory({ hostId, projectId }: { hostId: string; projectId: string }) {
  const { t, i18n } = useTranslation();
  const nav = useNavigate();
  const loc = useLocation();
  const qc = useQueryClient();
  const openDialog = useDialogs((s) => s.open);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const key = ['claudehist', projectId];
  const q = useQuery({ queryKey: key, queryFn: () => claudeApi.cliSessions(projectId, true), enabled: !!anchor, staleTime: 10_000 });
  const fail = (e: unknown) => toast(t(`errors.${e instanceof ApiError ? e.code : 'INTERNAL'}`, { defaultValue: t('errors.INTERNAL') }));
  const base = pbase(hostId, projectId);
  const sessions = useClaudeSessions().data ?? [];
  const running = (id?: string) => !!id && sessions.some((x) => x.id === id && (x.status === 'running' || x.status === 'awaiting_input'));

  const open = (c: { id: string; title: string; linkedId?: string; recent: boolean }) => {
    setAnchor(null);
    if (c.linkedId) return nav(`${base}/claude/${c.linkedId}`);
    const go = async () => {
      try {
        const s = await claudeApi.create(projectId, { resumeCliId: c.id, name: c.title });
        await qc.invalidateQueries({ queryKey: ck.sessions });
        void qc.invalidateQueries({ queryKey: key });
        void qc.invalidateQueries({ queryKey: ['claudecli', projectId] });
        nav(`${base}/claude/${s.id}`);
      } catch (e) {
        fail(e);
      }
    };
    // vừa sửa trong 2 phút → có thể đang chạy ở terminal khác: hỏi như màn Claude mới (AC-23)
    if (!c.recent) return void go();
    openDialog(<ConfirmDialog title={t('claude.cliRecentTitle', { name: c.title })} body={<p>{t('claude.cliRecentBody')}</p>} confirmLabel={t('claude.resume')} onConfirm={go} />);
  };
  const del = (c: { id: string; title: string; linkedId?: string }) => {
    setAnchor(null);
    openDialog(
      <ConfirmDialog
        danger
        title={t('hist.delTitle', { name: c.title })}
        body={
          <p>
            {t('hist.delBody')}
            {running(c.linkedId) && <b> {t('hist.delRunning')}</b>}
          </p>
        }
        confirmLabel={t('hist.del')}
        onConfirm={async () => {
          try {
            await claudeApi.removeCli(projectId, c.id);
          } catch (e) {
            fail(e);
          }
          // đang đứng ở phiên vừa xoá: chuyển trang rồi gỡ phiên khỏi cache trong cùng nhịp — không thì trang Claude thấy phiên
          // mất và văng về "/", hoặc trang Phiên chuyển lại vào chính phiên vừa xoá (dogfood edge V1)
          if (c.linkedId && loc.pathname.endsWith(`/claude/${c.linkedId}`)) nav(`${base}/sessions`);
          if (c.linkedId) qc.setQueryData<{ id: string }[]>(ck.sessions, (l) => l?.filter((x) => x.id !== c.linkedId));
          void qc.invalidateQueries({ queryKey: ck.sessions });
          void qc.invalidateQueries({ queryKey: key });
          void qc.invalidateQueries({ queryKey: ['claudecli', projectId] });
        }}
      />,
    );
  };
  const when = (iso: string) => new Date(iso).toLocaleString(i18n.language, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        iconOnly
        icon="history"
        label={t('hist.title')}
        aria-haspopup="menu"
        aria-expanded={!!anchor}
        onClick={(e) => {
          // tải xong mới mở → menu có dòng để nhận focus ngay (dogfood a11y #2: lần mở đầu focus kẹt ở nút)
          const rect = e.currentTarget.getBoundingClientRect();
          void qc.fetchQuery({ queryKey: key, queryFn: () => claudeApi.cliSessions(projectId, true), staleTime: 10_000 }).finally(() => setAnchor(rect));
        }}
      />
      {anchor && (
        <Menu anchor={anchor} width={360} onClose={() => setAnchor(null)}>
          <div className="grp">{t('hist.title')}</div>
          {q.isLoading ? (
            <div className="mi" style={{ cursor: 'default' }}>
              <span className="d">{t('hist.loading')}</span>
            </div>
          ) : q.data?.length ? (
            <div className="hist">
              {q.data.map((c) => (
                <div key={c.id} className="mi notif" style={{ gridTemplateColumns: 'minmax(0, 1fr)' }} role="menuitem" tabIndex={0} aria-keyshortcuts="Delete" onClick={() => void open(c)} onKeyDown={(e) => {
                  if (e.key === 'Enter') void open(c);
                  // nút 🗑 lồng trong dòng không tới được bằng Tab → Delete/⌫ trên dòng = xoá (dogfood a11y #1)
                  if (e.key === 'Delete' || e.key === 'Backspace') (e.preventDefault(), del(c));
                }}>
                  <b>
                    <Icon name="claude" className="claude-ic" />
                    <span className="grow ell" style={{ minWidth: 0 }}>
                      {c.title}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      iconOnly
                      icon="trash"
                      write
                      label={`${t('hist.del')} ${c.title}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        del(c);
                      }}
                    />
                  </b>
                  <span className="d ell" style={{ display: 'block' }}>
                    {when(c.updatedAt)}
                    {c.linkedId ? ` · ${t('hist.open')}` : c.recent ? ` · ${t('hist.recent')}` : ''}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="mi" style={{ cursor: 'default' }}>
              <span className="d">{t('hist.empty')}</span>
            </div>
          )}
        </Menu>
      )}
    </>
  );
}
