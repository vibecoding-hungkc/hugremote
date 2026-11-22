import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './Button';

const COLLAPSE_AT = 400;

/** C18 — khối diff unified: dòng thêm/xoá/ngữ cảnh, tiêu đề @@; thu gọn khi dài. */
export function DiffBlock({ diff }: { diff: string }) {
  const { t } = useTranslation();
  const lines = diff.split('\n').filter((l) => !/^(diff --git|index |--- |\+\+\+ |new file mode|deleted file mode|similarity index|rename (from|to))/.test(l));
  const [all, setAll] = useState(false);
  const shown = all ? lines : lines.slice(0, COLLAPSE_AT);
  if (!diff.trim()) return <div className="special muted">{t('git.noDiff')}</div>;
  return (
    <div className="diff" tabIndex={0}>
      {shown.map((l, i) => (
        <div key={i} className={l.startsWith('+') ? 'a' : l.startsWith('-') ? 'd' : l.startsWith('@@') ? 'h' : ''}>
          {l || ' '}
        </div>
      ))}
      {lines.length > COLLAPSE_AT && !all && (
        <div style={{ padding: 'var(--space-md)' }}>
          <Button size="sm" onClick={() => setAll(true)}>
            {t('git.showAll', { count: lines.length - COLLAPSE_AT })}
          </Button>
        </div>
      )}
    </div>
  );
}
