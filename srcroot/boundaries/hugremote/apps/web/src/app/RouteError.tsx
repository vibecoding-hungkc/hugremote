import { useTranslation } from 'react-i18next';
import { useRouteError } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { ErrorBox } from '../components/ui/States';
import { useConnection } from '../lib/connection';

/**
 * Lỗi khi dựng route (thường là tải chunk lazy lỗi lúc mất mạng): hiện hộp lỗi trong khung, KHÔNG tải lại cả trang —
 * nháp và bản sửa chưa lưu còn nguyên (AC-43). Nối lại → Thử lại.
 */
export function RouteError() {
  const { t } = useTranslation();
  const err = useRouteError() as Error | undefined;
  const online = useConnection((s) => s.online) && navigator.onLine;
  const chunk = /dynamically imported module|Importing a module script failed|Failed to fetch/i.test(String(err?.message ?? err));
  return (
    <div className="content">
      <div className="wrap">
        <ErrorBox
          title={chunk && !online ? t('net.chunkTitle') : t('errors.INTERNAL')}
          body={chunk ? t('net.chunkBody') : String(err?.message ?? '')}
          actions={
            <Button size="sm" icon="refresh" disabled={!online} disabledReason={t('net.offlineTip')} onClick={() => location.reload()}>
              {t('common.retry')}
            </Button>
          }
        />
      </div>
    </div>
  );
}
