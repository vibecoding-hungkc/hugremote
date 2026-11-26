import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/ui/Button';
import { useDialogs } from '../../components/ui/Dialogs';
import { Icon } from '../../components/ui/Icon';
import { Dialog, toast } from '../../components/ui/Overlay';
import i18n from '../../i18n';
import { ApiError } from '../../lib/api-client';
import { NOTE_MAX, saveNote, useNoteUi } from './notes';

const fail = (e: unknown) => toast(i18n.t(`errors.${e instanceof ApiError ? e.code : 'INTERNAL'}`, { defaultValue: i18n.t('errors.INTERNAL') }));

/** Ô gõ ghi chú dùng chung cho dải và hộp: Enter lưu · ⇧Enter xuống dòng · Esc huỷ. */
function NoteInput({
  initial,
  onSave,
  onCancel,
  autoFocus,
}: {
  initial: string;
  onSave: (v: string) => Promise<void>;
  onCancel: () => void;
  autoFocus?: boolean;
}) {
  const { t } = useTranslation();
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (autoFocus && el) (el.focus(), el.setSelectionRange(el.value.length, el.value.length));
  }, [autoFocus]);
  const save = async (val = v) => {
    if (busy) return;
    setBusy(true);
    try {
      await onSave(val);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="nedit">
      <textarea
        ref={ref}
        className="input"
        value={v}
        maxLength={NOTE_MAX}
        aria-label={t('note.label')}
        placeholder={t('note.placeholder')}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') (e.preventDefault(), e.stopPropagation(), onCancel());
          else if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) (e.preventDefault(), void save());
        }}
      />
      <div className="btns">
        <span className="muted xs grow">
          <span className="hide-mobile">{t('note.keys')} · </span>
          {v.length}/{NOTE_MAX}
        </span>
        {initial && (
          <Button variant="ghost" size="sm" write disabled={busy} onClick={() => void save('')}>
            {t('note.remove')}
          </Button>
        )}
        <Button size="sm" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button variant="primary" size="sm" write loading={busy} onClick={() => void save()}>
          {t('common.save')}
        </Button>
      </div>
    </div>
  );
}

/**
 * C51 — dải ghi chú dưới thanh tab của phiên đang mở (Authority 2026-11-26). Ai thấy phiên trong danh sách thì sửa được
 * ghi chú của nó: member chỉ thấy phiên mình, owner thấy tất cả (G-13, server kiểm lại).
 */
export function NoteBar({ sessionId, name, note }: { sessionId: string; name: string; note?: { text: string; updatedAt: string } }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const ui = useNoteUi();
  const editing = ui.editing === sessionId;
  if (!editing && (!note || ui.hidden[sessionId])) return null;
  const done = async (v: string) => {
    try {
      const n = await saveNote(qc, sessionId, v);
      ui.edit(null);
      toast(n.text ? t('note.saved') : t('note.removed'));
    } catch (e) {
      fail(e);
    }
  };
  if (editing)
    return (
      <div className="notebar" role="region" aria-label={t('note.region', { name })}>
        <Icon name="note" className="note-ic" />
        <NoteInput initial={note?.text ?? ''} onSave={done} onCancel={() => ui.edit(null)} autoFocus />
      </div>
    );
  const text = note!.text;
  const all = !!ui.open[sessionId];
  const long = text.length > 90 || text.includes('\n');
  return (
    <div className="notebar" role="region" aria-label={t('note.region', { name })}>
      <Icon name="note" className="note-ic" />
      <span
        className={`ntext ${all ? 'all' : 'one'}`}
        tabIndex={0}
        title={t('note.clickEdit')}
        onClick={() => ui.edit(sessionId)}
        onKeyDown={(e: KeyboardEvent) => e.key === 'Enter' && ui.edit(sessionId)}
      >
        {text}
      </span>
      <span className="nmeta hide-mobile">
        {new Date(note!.updatedAt).toLocaleString(i18n.language, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
      </span>
      {long && (
        <Button
          variant="ghost"
          size="sm"
          iconOnly
          icon={all ? 'chevu' : 'chevd'}
          label={all ? t('note.less') : t('note.more')}
          onClick={() => ui.setOpen(sessionId, !all)}
        />
      )}
      <Button variant="ghost" size="sm" iconOnly icon="edit" label={t('note.edit')} onClick={() => ui.edit(sessionId)} />
      <Button variant="ghost" size="sm" iconOnly icon="x" label={t('note.hide')} onClick={() => ui.setHidden(sessionId, true)} />
    </div>
  );
}

/** Hộp sửa ghi chú cho phiên không đang mở (menu ⋯ của phiên trong cây). */
export function NoteDialog({ sessionId, name, initial }: { sessionId: string; name: string; initial: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const close = useDialogs((s) => s.close);
  return (
    <Dialog title={t('note.dialogTitle', { name })} onClose={close}>
      <p className="muted sm">{t('note.dialogBody', { max: NOTE_MAX })}</p>
      <div className="notebar plain">
        <NoteInput
          initial={initial}
          autoFocus
          onCancel={close}
          onSave={async (v) => {
            try {
              const n = await saveNote(qc, sessionId, v);
              close();
              toast(n.text ? t('note.saved') : t('note.removed'));
            } catch (e) {
              fail(e);
            }
          }}
        />
      </div>
    </Dialog>
  );
}
