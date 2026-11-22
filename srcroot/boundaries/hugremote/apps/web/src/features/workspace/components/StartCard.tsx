import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../../components/ui/Button';
import { Icon } from '../../../components/ui/Icon';
import { useMe } from '../../auth/hooks/useMe';

/** C26 — thẻ Bắt đầu 3 bước, tự đánh dấu theo dữ liệu thật; ẩn khi xong cả 3 (AC-28). Chỉ owner. */
export function StartCard({ hostCount, projectCount, sessionCount }: { hostCount: number; projectCount: number; sessionCount: number }) {
  const { t } = useTranslation();
  const nav = useNavigate();
  const me = useMe();
  if (me.data?.role !== 'owner') return null;
  const steps = [
    { label: t('start.step1'), done: hostCount > 1 || projectCount > 0, act: () => nav('/hosts'), cta: t('start.cta1') },
    { label: t('start.step2'), done: projectCount > 0, act: () => nav('/s/local/new-project'), cta: t('start.cta2') },
    { label: t('start.step3'), done: sessionCount > 0, act: () => nav('/s/local/new-project'), cta: t('start.cta3') },
  ];
  const cur = steps.findIndex((s) => !s.done);
  if (cur < 0) return null;
  return (
    <div className="card start" aria-label={t('start.title')}>
      <h3>{t('start.title')}</h3>
      <div className="steps">
        {steps.map((s, i) => (
          <div key={i} className={`step ${s.done ? 'done' : ''} ${i === cur ? 'cur' : ''}`}>
            <span className="n">{s.done ? <Icon name="check" /> : i + 1}</span>
            <span className="lbl grow">{s.label}</span>
          </div>
        ))}
      </div>
      <div className="btns">
        <Button variant="primary" onClick={steps[cur].act}>
          {steps[cur].cta}
        </Button>
        {cur === 0 && (
          <Button variant="ghost" onClick={() => nav('/s/local/new-project')}>
            {t('start.skip')}
          </Button>
        )}
      </div>
    </div>
  );
}
