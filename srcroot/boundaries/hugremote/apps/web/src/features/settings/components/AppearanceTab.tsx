import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { applyPreferences } from '../../../app/usePreferences';
import { Button } from '../../../components/ui/Button';
import { toast } from '../../../components/ui/Overlay';
import { useUi } from '../../../stores/ui.store';
import { authApi, type Me } from '../../auth/api/auth.api';

/** Chủ đề sáng/tối/theo hệ thống + ngôn ngữ — lưu theo người dùng, đồng bộ mọi thiết bị (AC-27). */
export function AppearanceTab({ me }: { me: Me }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const set = useUi((s) => s.set);
  const theme = me.preferences.theme ?? 'dark';
  const locale = me.preferences.locale ?? 'vi';
  const save = async (p: Partial<Me['preferences']>) => {
    // lấy bản mới nhất trong cache — hai lần đổi liền nhau không ghi đè nhau
    const cur = qc.getQueryData<Me>(['me']) ?? me;
    const next = { ...cur.preferences, ...p };
    applyPreferences(next);
    qc.setQueryData<Me>(['me'], { ...cur, preferences: next });
    try {
      await authApi.patchPreferences(p);
    } catch {
      toast(t('errors.INTERNAL'));
      void qc.invalidateQueries({ queryKey: ['me'] });
    }
  };
  return (
    <>
      <div className="card">
        <div className="grid2">
          <div className="field" style={{ margin: 0 }}>
            <label>{t('settings.theme')}</label>
            <div className="seg" role="radiogroup" aria-label={t('settings.theme')}>
              {(['dark', 'light', 'system'] as const).map((k) => (
                <button key={k} role="radio" aria-checked={theme === k} className={theme === k ? 'on' : ''} onClick={() => void save({ theme: k })}>
                  {t(`settings.theme_${k}`)}
                </button>
              ))}
            </div>
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>{t('settings.language')}</label>
            <div className="seg" role="radiogroup" aria-label={t('settings.language')}>
              {(['vi', 'en'] as const).map((k) => (
                <button key={k} role="radio" aria-checked={locale === k} className={locale === k ? 'on' : ''} onClick={() => void save({ locale: k })}>
                  {k === 'vi' ? 'Tiếng Việt' : 'English'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="card">
        <h3>{t('keys.title')}</h3>
        <p className="muted sm">{t('settings.keysHint')}</p>
        <div className="btns">
          <Button size="sm" icon="keyi" onClick={() => set({ keys: true })}>
            {t('settings.showKeys')}
          </Button>
        </div>
      </div>
    </>
  );
}
