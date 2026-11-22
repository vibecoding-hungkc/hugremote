import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { create } from 'zustand';
import { Button } from './Button';
import { Dialog } from './Overlay';

/** Một hộp thoại toàn cục mỗi lúc — mở từ bất cứ đâu, vẽ ở vỏ app. */
export const useDialogs = create<{ node: ReactNode; open: (n: ReactNode) => void; close: () => void }>((set) => ({
  node: null,
  open: (node) => set({ node }),
  close: () => set({ node: null }),
}));

export function DialogHost() {
  return <>{useDialogs((s) => s.node)}</>;
}

/** C9 — xác nhận (biến thể cảnh báo đỏ khi `danger`). `onConfirm` trả Promise → nút "Đang …" tới khi xong. */
export function ConfirmDialog({ title, body, confirmLabel, danger, onConfirm }: { title: string; body: ReactNode; confirmLabel: string; danger?: boolean; onConfirm: () => Promise<unknown> | void }) {
  const { t } = useTranslation();
  const close = useDialogs((s) => s.close);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <Dialog title={title} onClose={close} danger={danger}>
      <div>{body}</div>
      {err && <p className="msg">{err}</p>}
      <div className="btns" style={{ justifyContent: 'flex-end' }}>
        <Button onClick={close}>{t('common.cancel')}</Button>
        <Button
          variant={danger ? 'danger' : 'primary'}
          write
          loading={busy}
          loadingLabel={t('common.working')}
          onClick={async () => {
            setBusy(true);
            try {
              await onConfirm();
              close();
            } catch (e) {
              setErr(t(`errors.${(e as { code?: string }).code ?? 'INTERNAL'}`, { defaultValue: t('errors.INTERNAL') }));
              setBusy(false);
            }
          }}
        >
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}

/** C9 — đổi tên hiển thị: Enter lưu, Esc huỷ, an toàn IME (không lưu khi đang gõ dấu). */
export function RenameDialog({ title, initial, onSave }: { title: string; initial: string; onSave: (name: string) => Promise<unknown> }) {
  const { t } = useTranslation();
  const close = useDialogs((s) => s.close);
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!v.trim() || busy) return;
    setBusy(true);
    try {
      await onSave(v.trim());
      close();
    } catch {
      setBusy(false);
    }
  };
  return (
    <Dialog title={title} onClose={close}>
      <div className="field">
        <input
          className="input"
          value={v}
          maxLength={80}
          aria-label={title}
          onChange={(e) => setV(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) void save();
          }}
        />
      </div>
      <div className="btns" style={{ justifyContent: 'flex-end' }}>
        <Button onClick={close}>{t('common.cancel')}</Button>
        <Button variant="primary" write loading={busy} onClick={() => void save()} disabled={!v.trim()}>
          {t('common.save')}
        </Button>
      </div>
    </Dialog>
  );
}
