import { useTranslation } from 'react-i18next';
import { EmptyState } from '../components/ui/States';

/** S2 — khung tạm của walking skeleton; cây Máy → Dự án → Phiên dựng ở lát 3. */
export function WorkspacePage() {
  const { t } = useTranslation();
  return (
    <div className="content" data-screen="S2">
      <div className="wrap">
        <EmptyState icon="server" message={t('app.name')} />
      </div>
    </div>
  );
}
