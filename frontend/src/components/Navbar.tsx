import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { LANGS, type TKey } from '../i18n';
import type { AdminUser, Organizer } from '../types';
import NotificationBell from './NotificationBell';
import { Avatar } from './ui';
import './Navbar.css';

interface NavItem {
  to: string;
  icon: string;
  label: TKey;
  /** Shorter wording for the top bar; the menu drawer and page titles use `label`. */
  short?: TKey;
  end?: boolean;
  tour?: string;
}

const PUBLIC_LINKS: NavItem[] = [
  { to: '/', icon: 'house', label: 'nav_home', end: true },
  { to: '/conferences', icon: 'calendar-days', label: 'nav_conferences' },
  { to: '/about', icon: 'circle-info', label: 'nav_about' },
  { to: '/contact', icon: 'envelope', label: 'nav_contact' },
];

const ORGANIZER_LINKS: NavItem[] = [
  { to: '/dashboard', icon: 'gauge-high', label: 'nav_my_dashboard', short: 'navbar_my_dashboard', tour: 'nav-dashboard' },
  { to: '/my-conferences', icon: 'calendar-check', label: 'nav_my_conferences' },
  { to: '/check-in', icon: 'qrcode', label: 'nav_check_in', short: 'navbar_check_in' },
  { to: '/analytics', icon: 'chart-line', label: 'nav_analytics' },
];

const ADMIN_LINKS: NavItem[] = [
  { to: '/admin', icon: 'gauge-high', label: 'nav_my_dashboard', short: 'navbar_my_dashboard', end: true },
  { to: '/admin/organizers', icon: 'user-tie', label: 'nav_organizers' },
  { to: '/admin/conferences', icon: 'calendar-days', label: 'nav_conferences' },
  { to: '/admin/feedback', icon: 'comments', label: 'nav_feedback' },
  { to: '/admin/activity', icon: 'list-check', label: 'nav_activity' },
];

/**
 * Tiers, chosen by measuring whether the bar fits (so it works for every language):
 * 0 everything; 1 tighter spacing and a compact account chip; 2 links without icons;
 * 3 icon-only sign-in buttons and language button; 4 icon-only links; 5 menu button.
 */
const MAX_TIER = 5;
const ICON_ONLY_LINKS = 4;

export default function Navbar() {
  const { role, user, t, lang, setLang, theme, toggleTheme, logout } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const [tier, setTier] = useState(0);
  const [width, setWidth] = useState(() => window.innerWidth);
  const [menuOpen, setMenuOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const innerRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);
  const langRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const [menuRight, setMenuRight] = useState(16);

  // Menus are position:fixed (the bar clips overflow), so line them up under their button.
  const anchor = (el: HTMLElement | null) => {
    if (el) setMenuRight(Math.max(8, window.innerWidth - el.getBoundingClientRect().right));
  };

  const links = role === 'admin' ? ADMIN_LINKS : role === 'organizer' ? ORGANIZER_LINKS : PUBLIC_LINKS;
  const name = role === 'organizer' ? `${(user as Organizer).first_name} ${(user as Organizer).last_name}` : role === 'admin' ? t('role_admin') : '';
  const avatar = role === 'organizer' ? (user as Organizer).avatar : null;
  const email = role === 'organizer' ? (user as Organizer).email : role === 'admin' ? (user as AdminUser).email : '';
  const dashboard = role === 'admin' ? '/admin' : '/dashboard';
  const measureKey = useMemo(() => `${width}|${lang}|${role}|${name}`, [width, lang, role, name]);

  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  // Start from the fullest bar whenever the width, language or account changes...
  useLayoutEffect(() => { setTier(0); }, [measureKey]);
  // ...then step down one tier at a time, before paint, until nothing overflows.
  useLayoutEffect(() => {
    const el = innerRef.current;
    if (!el || tier >= MAX_TIER) return;
    if (el.scrollWidth > el.clientWidth + 1) setTier((x) => Math.min(MAX_TIER, x + 1));
  }, [tier, measureKey]);

  useEffect(() => { setMenuOpen(false); setUserOpen(false); setLangOpen(false); }, [location.pathname]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (userRef.current && !userRef.current.contains(target)) setUserOpen(false);
      if (langRef.current && !langRef.current.contains(target)) setLangOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setUserOpen(false); setLangOpen(false); setMenuOpen(false); }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  const doLogout = () => {
    logout();
    navigate('/');
  };

  const current = LANGS.find((l) => l.code === lang)!;
  const collapsed = tier >= MAX_TIER;

  const langSwitch = (
    <div className="nav-pop" ref={langRef}>
      <button
        type="button"
        className="nav-btn nav-btn--lang"
        onClick={(e) => { anchor(e.currentTarget); setLangOpen((o) => !o); setUserOpen(false); }}
        aria-haspopup="menu"
        aria-expanded={langOpen}
        aria-label={t('language')}
        title={t('language')}
      >
        <i className="fas fa-globe" aria-hidden="true" />
        {tier < 3 && <span>{current.short}</span>}
        <i className="fas fa-chevron-down nav-caret" aria-hidden="true" />
      </button>
      {langOpen && (
        <div className="nav-menu nav-menu--lang" role="menu" style={{ right: menuRight }}>
          {LANGS.map((l) => (
            <button
              key={l.code}
              role="menuitemradio"
              aria-checked={l.code === lang}
              className={`nav-menu__item${l.code === lang ? ' is-active' : ''}`}
              onClick={() => { setLang(l.code); setLangOpen(false); }}
            >
              <span className="nav-lang-code">{l.short}</span>
              <span>{l.name}</span>
              {l.code === lang && <i className="fas fa-check" aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  const themeBtn = (
    <button
      type="button"
      className="nav-btn nav-btn--icon"
      onClick={toggleTheme}
      aria-label={theme === 'dark' ? t('light_mode') : t('dark_mode')}
      title={theme === 'dark' ? t('light_mode') : t('dark_mode')}
    >
      <i className={`fas fa-${theme === 'dark' ? 'sun' : 'moon'} nav-theme-icon`} aria-hidden="true" key={theme} />
    </button>
  );

  const userMenu = role && (
    <div className="nav-pop" ref={userRef} data-tour="nav-user">
      <button
        type="button"
        className="nav-user"
        onClick={(e) => { anchor(e.currentTarget); setUserOpen((o) => !o); setLangOpen(false); }}
        aria-haspopup="menu"
        aria-expanded={userOpen}
        aria-label={t('account_menu')}
      >
        <Avatar name={name} src={avatar} size={38} />
        {tier < 1 && (
          <span className="nav-user__text">
            <strong>{role === 'organizer' ? (user as Organizer).first_name : name}</strong>
            <small>{role === 'admin' ? t('role_admin') : t('role_organizer')}</small>
          </span>
        )}
        <i className="fas fa-chevron-down nav-caret" aria-hidden="true" />
      </button>
      {userOpen && (
        <div className="nav-menu nav-menu--user" role="menu" style={{ right: menuRight }}>
          <div className="nav-menu__head">
            <Avatar name={name} src={avatar} size={46} />
            <div>
              <strong>{name}</strong>
              <small>{email}</small>
            </div>
          </div>
          <Link role="menuitem" to={dashboard} className="nav-menu__item"><i className="fas fa-gauge-high" /> {t('nav_my_dashboard')}</Link>
          {role === 'organizer' && (
            <>
              <Link role="menuitem" to="/conferences" className="nav-menu__item"><i className="fas fa-globe" /> {t('browse_conferences')}</Link>
              <Link role="menuitem" to="/settings" className="nav-menu__item"><i className="fas fa-user-gear" /> {t('nav_settings')}</Link>
              <Link role="menuitem" to="/help" className="nav-menu__item"><i className="fas fa-life-ring" /> {t('nav_help')}</Link>
            </>
          )}
          <button role="menuitem" className="nav-menu__item nav-menu__item--danger" onClick={doLogout}>
            <i className="fas fa-right-from-bracket" /> {t('logout')}
          </button>
        </div>
      )}
    </div>
  );

  const authButtons = !role && (
    <div className="nav-auth">
      <Link to="/login" className={`btn btn--ghost nav-auth__login${tier >= 3 ? ' btn--icon' : ''}`} title={t('login')} aria-label={t('login')}>
        <i className="fas fa-right-to-bracket" />{tier < 3 && <> {t('login')}</>}
      </Link>
      <Link to="/register" className={`btn btn--primary${tier >= 3 ? ' btn--icon' : ''}`} title={t('register')} aria-label={t('register')}>
        <i className="fas fa-user-plus" />{tier < 3 && <> {t('register')}</>}
      </Link>
    </div>
  );

  return (
    <header className={`nav${scrolled ? ' nav--scrolled' : ''}`}>
      <div className={`nav__inner nav--tier-${tier}`} ref={innerRef}>
        <Link to={role ? dashboard : '/'} className="nav__brand" aria-label="ConferenceHub">
          <span className="nav__logo"><i className="fas fa-calendar-check" aria-hidden="true" /></span>
          <span className="nav__name">Conference<span>Hub</span></span>
        </Link>

        {!collapsed && (
          <nav className="nav__links" aria-label={t('main_menu')} data-tour="nav-links">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                className={({ isActive }) => `nav__link${isActive ? ' is-active' : ''}`}
                title={tier >= ICON_ONLY_LINKS ? t(l.label) : undefined}
                aria-label={tier >= ICON_ONLY_LINKS ? t(l.label) : undefined}
                data-tour={l.tour}
              >
                {(tier < 2 || tier >= ICON_ONLY_LINKS) && <i className={`fas fa-${l.icon}`} aria-hidden="true" />}
                {tier < ICON_ONLY_LINKS && <span>{t(l.short ?? l.label)}</span>}
              </NavLink>
            ))}
          </nav>
        )}

        <div className="nav__controls">
          {!collapsed && langSwitch}
          {!collapsed && themeBtn}
          {role && <NotificationBell />}
          {!collapsed && userMenu}
          {!collapsed && authButtons}
          {collapsed && (
            <button
              type="button"
              className="nav-btn nav-btn--icon nav-burger"
              onClick={() => setMenuOpen((o) => !o)}
              aria-expanded={menuOpen}
              aria-label={menuOpen ? t('close_menu') : t('open_menu')}
            >
              <i className={`fas fa-${menuOpen ? 'xmark' : 'bars'}`} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {collapsed && menuOpen && (
        <div className="nav-drawer" role="dialog" aria-label={t('main_menu')}>
          <div className="nav-drawer__panel">
            {role && (
              <div className="nav-drawer__user">
                <Avatar name={name} src={avatar} size={48} />
                <div>
                  <strong>{name}</strong>
                  <small>{email}</small>
                </div>
              </div>
            )}
            <nav className="nav-drawer__links">
              {links.map((l) => (
                <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => `nav-drawer__link${isActive ? ' is-active' : ''}`}>
                  <i className={`fas fa-${l.icon}`} aria-hidden="true" /> {t(l.label)}
                </NavLink>
              ))}
              {role === 'organizer' && (
                <>
                  <NavLink to="/conferences" className={({ isActive }) => `nav-drawer__link${isActive ? ' is-active' : ''}`}><i className="fas fa-globe" /> {t('browse_conferences')}</NavLink>
                  <NavLink to="/settings" className={({ isActive }) => `nav-drawer__link${isActive ? ' is-active' : ''}`}><i className="fas fa-user-gear" /> {t('nav_settings')}</NavLink>
                  <NavLink to="/help" className={({ isActive }) => `nav-drawer__link${isActive ? ' is-active' : ''}`}><i className="fas fa-life-ring" /> {t('nav_help')}</NavLink>
                </>
              )}
            </nav>
            <div className="nav-drawer__section">
              <span className="label">{t('language')}</span>
              <div className="nav-drawer__langs">
                {LANGS.map((l) => (
                  <button key={l.code} className={`chip${l.code === lang ? ' chip--accent' : ''}`} aria-pressed={l.code === lang} onClick={() => setLang(l.code)}>
                    {l.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="nav-drawer__section">
              <button className="btn btn--block" onClick={toggleTheme}>
                <i className={`fas fa-${theme === 'dark' ? 'sun' : 'moon'}`} /> {theme === 'dark' ? t('light_mode') : t('dark_mode')}
              </button>
              {role ? (
                <button className="btn btn--danger btn--block" onClick={doLogout}>
                  <i className="fas fa-right-from-bracket" /> {t('logout')}
                </button>
              ) : (
                <div className="nav-drawer__auth">
                  <Link to="/login" className="btn btn--block"><i className="fas fa-right-to-bracket" /> {t('login')}</Link>
                  <Link to="/register" className="btn btn--primary btn--block"><i className="fas fa-user-plus" /> {t('register')}</Link>
                </div>
              )}
            </div>
          </div>
          <button className="nav-drawer__scrim" aria-label={t('close_menu')} onClick={() => setMenuOpen(false)} />
        </div>
      )}
    </header>
  );
}
