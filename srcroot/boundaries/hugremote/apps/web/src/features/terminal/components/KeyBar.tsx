import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '../../../components/ui/Icon';
import { useCtrlLatch } from './terminal-pool';

const SEQ: Record<string, string> = {
  Esc: '\x1b',
  Tab: '\t',
  '↑': '\x1b[A',
  '↓': '\x1b[B',
  '→': '\x1b[C',
  '←': '\x1b[D',
  '↵': '\r',
  '^C': '\x03',
  Home: '\x1b[H',
  End: '\x1b[F',
  PgUp: '\x1b[5~',
  PgDn: '\x1b[6~',
  F1: '\x1bOP',
  F2: '\x1bOQ',
  F3: '\x1bOR',
  F4: '\x1bOS',
  F5: '\x1b[15~',
  F6: '\x1b[17~',
  F7: '\x1b[18~',
  F8: '\x1b[19~',
  F9: '\x1b[20~',
  F10: '\x1b[21~',
  F11: '\x1b[23~',
  F12: '\x1b[24~',
};

/** C10 — thanh phím cảm ứng (chỉ hiện <768px): Ctrl giữ một lần cho phím kế tiếp; ngăn mở rộng: tổ hợp Ctrl, F1–F12, ký tự shell, lệnh nhanh. */
export function KeyBar({ send }: { send: (d: string) => void }) {
  const { t } = useTranslation();
  const ctrl = useCtrlLatch((s) => s.on);
  const setCtrl = useCtrlLatch((s) => s.set);
  const [drawer, setDrawer] = useState(false);
  const press = (label: string) => {
    if (/^\^[A-Z]$/.test(label)) return send(String.fromCharCode(label.charCodeAt(1) - 64));
    if (label.endsWith(' ↵')) return send(label.slice(0, -2) + '\r');
    if (label.includes(' ') && label.length === 3) return send(label.replace(' ', '')); // "{ }" → "{}"
    const seq = SEQ[label] ?? label;
    if (ctrl && seq.length === 1) {
      setCtrl(false);
      return send(String.fromCharCode(seq.toUpperCase().charCodeAt(0) & 0x1f));
    }
    send(seq);
  };
  const k = (label: string, title?: string, on?: boolean, onClick?: () => void) => (
    <button key={label} className={`key ${on ? 'on' : ''}`} title={title} aria-label={title} onMouseDown={(e) => e.preventDefault()} onClick={onClick ?? (() => press(label))}>
      {label}
    </button>
  );
  return (
    <div className="keybar" aria-label={t('term.keybar')}>
      <div className="keys">
        {k('^C', t('term.ctrlC'))}
        {k('Esc')}
        {k('Tab')}
        {k('Ctrl', t('term.ctrlHold'), ctrl, () => setCtrl(!ctrl))}
        {['↑', '↓', '←', '→', '↵'].map((x) => k(x))}
        <button className={`key pin-r ${drawer ? 'on' : ''}`} title={t(drawer ? 'term.lessKeys' : 'term.moreKeys')} aria-label={t(drawer ? 'term.lessKeys' : 'term.moreKeys')} onMouseDown={(e) => e.preventDefault()} onClick={() => setDrawer(!drawer)}>
          <Icon name="kb" />
        </button>
      </div>
      {drawer && (
        <div className="drawer">
          <div className="grp">{t('term.grpCtrl')}</div>
          <div className="keys">{['^D', '^Z', '^L', '^A', '^E', '^W', '^U', '^K', '^R'].map((x) => k(x))}</div>
          <div className="grp">{t('term.grpF')}</div>
          <div className="keys">{Array.from({ length: 12 }, (_, i) => k(`F${i + 1}`))}</div>
          <div className="grp">{t('term.grpShell')}</div>
          <div className="keys">{['|', '>', '&&', '~', '/', '-', '$', '*', '"', "'", '{ }', '( )', '[ ]'].map((x) => k(x))}</div>
          <div className="grp">{t('term.grpQuick')}</div>
          <div className="keys">{['ls -la ↵', 'cd .. ↵', 'git status ↵', 'clear ↵', 'claude ↵'].map((x) => k(x))}</div>
          <div className="grp">{t('term.grpScroll')}</div>
          <div className="keys">{['Home', 'End', 'PgUp', 'PgDn'].map((x) => k(x))}</div>
        </div>
      )}
    </div>
  );
}
