import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { CONTACT_EMAIL, CREATOR } from '../config';
import './Footer.css';

export default function Footer() {
  const { t, role } = useApp();
  const year = new Date().getFullYear();
  return (
    <footer className="footer">
      <div className="container footer__grid">
        <div className="footer__brand">
          <Link to="/" className="nav__brand">
            <img className="nav__logo" src="/logo.svg" alt="" width="44" height="44" />
            <span className="nav__name">Conference<span>Hub</span></span>
          </Link>
          <p>{t('footer_tagline')}</p>
        </div>
        <div>
          <h4>{t('footer_explore')}</h4>
          <Link to="/conferences">{t('nav_conferences')}</Link>
          <Link to="/about">{t('nav_about')}</Link>
          <Link to="/contact">{t('nav_contact')}</Link>
        </div>
        <div>
          <h4>{t('footer_organizers')}</h4>
          {role === 'organizer' ? (
            <>
              <Link to="/dashboard">{t('nav_my_dashboard')}</Link>
              <Link to="/my-conferences">{t('nav_my_conferences')}</Link>
              <Link to="/help">{t('nav_help')}</Link>
            </>
          ) : (
            <>
              <Link to="/register">{t('footer_start_organizing')}</Link>
              <Link to="/login">{t('login')}</Link>
              <Link to="/admin/login">{t('admin_login')}</Link>
            </>
          )}
        </div>
        <div>
          <h4>{t('footer_contact')}</h4>
          {CONTACT_EMAIL && <a href={`mailto:${CONTACT_EMAIL}`}><i className="fas fa-envelope" /> {CONTACT_EMAIL}</a>}
          <span className="muted"><i className="fas fa-location-dot" /> {t('footer_location')}</span>
        </div>
      </div>
      <div className="container footer__bottom">
        <span>© {year} ConferenceHub. {t('footer_rights')}</span>
        <span className="muted">{t('footer_made')}</span>
        <Link to="/about#creator" className="footer__creator">
          <img src={CREATOR.photo} alt="" width="26" height="26" loading="lazy" />
          {t('footer_created_by', { name: CREATOR.name })}
        </Link>
      </div>
    </footer>
  );
}
