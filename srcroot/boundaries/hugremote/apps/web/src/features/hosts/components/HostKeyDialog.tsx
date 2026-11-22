import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/ui/Button';
import { Dialog } from '../../../components/ui/Overlay';

export interface HostKeyInfo {
  hostId: string;
  host: string;
  port: number;
  keyType: string;
  fingerprint: string;
  oldFingerprint?: string;
  via?: string;
}

/** S4 — tin host key. Khoá đổi: cảnh báo đỏ, phải tick "đã đối chiếu" mới bật nút (AC-6). */
export function HostKeyDialog({ info, onTrust, onClose }: { info: HostKeyInfo; onTrust: () => Promise<void>; onClose: () => void }) {
  const { t } = useTranslation();
  const changed = !!info.oldFingerprint;
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <Dialog title={changed ? t('hostkey.changedTitle') : t('hostkey.title')} onClose={onClose} danger={changed}>
      <div data-screen="S4" style={{ display: 'contents' }}>
        <p>
          {changed ? t('hostkey.changedBody') : t('hostkey.body')} {!changed && <span className="mono">ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub</span>}
        </p>
        <dl className="kv">
          <dt>{t('hostkey.host')}</dt>
          <dd>{info.hostId}</dd>
          <dt>{t('hostkey.address')}</dt>
          <dd className="mono">
            {info.host}:{info.port}
            {info.via ? ` (${t('hostkey.via', { via: info.via })})` : ''}
          </dd>
          <dt>{t('hostkey.keyType')}</dt>
          <dd className="mono">{info.keyType}</dd>
        </dl>
        {changed && (
          <div>
            <div className="xs muted">{t('hostkey.oldFp')}</div>
            <div className="fp old">{info.oldFingerprint}</div>
          </div>
        )}
        <div>
          <div className="xs muted">{changed ? t('hostkey.newFp') : t('hostkey.fp')}</div>
          <div className="fp">{info.fingerprint}</div>
        </div>
        {changed && (
          <label className="chk">
            <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
            {t('hostkey.ack')}
          </label>
        )}
        <div className="btns" style={{ justifyContent: 'flex-end' }}>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button
            variant={changed ? 'danger' : 'primary'}
            write
            disabled={changed && !ack}
            loading={busy}
            loadingLabel={t('hostkey.connecting')}
            onClick={async () => {
              setBusy(true);
              try {
                await onTrust();
              } finally {
                setBusy(false);
              }
            }}
          >
            {changed ? t('hostkey.trustNew') : t('hostkey.trust')}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
