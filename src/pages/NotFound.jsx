import { Link } from 'react-router-dom';
import { Empty } from '../components/ui.jsx';
import { useI18n } from '../i18n/I18nContext.jsx';

export default function NotFound() {
  const { t } = useI18n();
  return (
    <div className="card">
      <Empty code="404" title={t('notFound.title')}>
        <p>{t('notFound.text')}</p>
        <Link to="/">{t('notFound.home')}</Link>
      </Empty>
    </div>
  );
}
