import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useApp } from "../context/AppContext";
import "./Navbar.css";

export default function Navbar() {
  const { token, role, user, logout, t, lang, setLang, theme, toggleTheme } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/");
    setMenuOpen(false);
  };

  const isAdmin = role === "admin";
  const isOrganizer = role === "organizer";

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="navbar-brand" onClick={() => setMenuOpen(false)}>
          <i className="fas fa-calendar-alt" />
          <span>ConferenceHub</span>
        </Link>

        <button className="navbar-burger" onClick={() => setMenuOpen(!menuOpen)} aria-label="Menu">
          <i className={`fas fa-${menuOpen ? "times" : "bars"}`} />
        </button>

        <div className={`navbar-menu ${menuOpen ? "open" : ""}`}>
          <div className="navbar-links">
            {!isAdmin && (
              <Link to="/conferences" className={`nav-link ${location.pathname === "/conferences" ? "active" : ""}`} onClick={() => setMenuOpen(false)}>
                {t("conferences")}
              </Link>
            )}
            {isOrganizer && (
              <>
                <Link to="/dashboard" className={`nav-link ${location.pathname === "/dashboard" ? "active" : ""}`} onClick={() => setMenuOpen(false)}>
                  {t("dashboard")}
                </Link>
                <Link to="/my-conferences" className={`nav-link ${location.pathname === "/my-conferences" ? "active" : ""}`} onClick={() => setMenuOpen(false)}>
                  {t("my_conferences")}
                </Link>
              </>
            )}
            {isAdmin && (
              <>
                <Link to="/admin" className="nav-link" onClick={() => setMenuOpen(false)}>{t("overview")}</Link>
                <Link to="/admin/organizers" className="nav-link" onClick={() => setMenuOpen(false)}>{t("organizer_management")}</Link>
                <Link to="/admin/conferences" className="nav-link" onClick={() => setMenuOpen(false)}>{t("conferences")}</Link>
                <Link to="/admin/feedback" className="nav-link" onClick={() => setMenuOpen(false)}>{t("feedback_management")}</Link>
                <Link to="/admin/activity" className="nav-link" onClick={() => setMenuOpen(false)}>{t("activity_log")}</Link>
              </>
            )}
          </div>

          <div className="navbar-controls">
            <select
              className="lang-select"
              value={lang}
              onChange={(e) => setLang(e.target.value)}
            >
              <option value="en">EN</option>
              <option value="si">සි</option>
              <option value="ta">த</option>
            </select>

            <button className="theme-btn" onClick={toggleTheme} title={t(theme === "dark" ? "light_mode" : "dark_mode")}>
              <i className={`fas fa-${theme === "dark" ? "sun" : "moon"}`} />
            </button>

            {token ? (
              <div className="navbar-user">
                {isOrganizer && (
                  <>
                    <Link to="/settings" className="btn btn-ghost btn-sm" onClick={() => setMenuOpen(false)}>
                      <i className="fas fa-cog" />
                    </Link>
                    <Link to="/help" className="btn btn-ghost btn-sm" onClick={() => setMenuOpen(false)}>
                      <i className="fas fa-question-circle" />
                    </Link>
                  </>
                )}
                <button onClick={handleLogout} className="btn btn-ghost btn-sm">
                  <i className="fas fa-sign-out-alt" />
                  <span className="logout-text">{t("logout")}</span>
                </button>
              </div>
            ) : (
              <div className="navbar-auth">
                <Link to="/login" className="btn btn-ghost btn-sm" onClick={() => setMenuOpen(false)}>{t("login")}</Link>
                <Link to="/register" className="btn btn-primary btn-sm" onClick={() => setMenuOpen(false)}>{t("register")}</Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
