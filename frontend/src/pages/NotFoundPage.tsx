import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { usePageTitle } from '../hooks';
import { EmptyState } from '../components/ui';
import { HOME_OF } from '../App';

export default function NotFoundPage() {
  const { t, role } = useApp();
  usePageTitle('not_found_title');
  return (
    <div className="container page">
      <EmptyState icon="map-signs" title={t('not_found_title')} message={t('not_found_body')}>
        <Link to={role ? HOME_OF[role] : '/'} className="btn btn--primary"><i className="fas fa-house" /> {role ? t('nav_my_dashboard') : t('nav_home')}</Link>
        <Link to="/conferences" className="btn"><i className="fas fa-compass" /> {t('browse_conferences')}</Link>
      </EmptyState>
    </div>
  );
}
