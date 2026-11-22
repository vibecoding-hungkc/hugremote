import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Skeleton } from '../components/ui/States';
import { useMe } from '../features/auth/hooks/useMe';
import { AccountTab } from '../features/settings/components/AccountTab';
import { AppearanceTab } from '../features/settings/components/AppearanceTab';
import { TeamTab } from '../features/settings/components/TeamTab';
import { SystemTab } from '../features/settings/components/SystemTab';

type Tab = 'account' | 'team' | 'appearance' | 'system';

/** S7 — Cài đặt: Tài khoản & bảo mật · Nhóm (SSO) · Giao diện · Hệ thống — Nhóm và Hệ thống chỉ owner. */
export function SettingsPage() {
  const { t } = useTranslation();
  const me = useMe().data;
  const [tab, setTab] = useState<Tab>('account');
  if (!me)
    return (
      <div className="content" data-screen="S7">
        <div className="wrap">
          <Skeleton rows={4} />
        </div>
      </div>
    );
  const owner = me.role === 'owner';
  const tabs: Tab[] = owner ? ['account', 'team', 'appearance', 'system'] : ['account', 'appearance'];
  const cur = tabs.includes(tab) ? tab : 'account';
  return (
    <div className="content" data-screen="S7" aria-label={t('nav.settings')}>
      <div className="wrap">
        <div className="subnav seg" role="tablist">
          {tabs.map((k) => (
            <button key={k} role="tab" aria-selected={cur === k} className={cur === k ? 'on' : ''} onClick={() => setTab(k)}>
              {t(`settings.tab_${k}${k === 'account' && owner ? '_owner' : ''}`)}
            </button>
          ))}
        </div>
        {cur === 'account' && <AccountTab me={me} />}
        {cur === 'team' && owner && <TeamTab />}
        {cur === 'appearance' && <AppearanceTab me={me} />}
        {cur === 'system' && owner && <SystemTab />}
      </div>
    </div>
  );
}
