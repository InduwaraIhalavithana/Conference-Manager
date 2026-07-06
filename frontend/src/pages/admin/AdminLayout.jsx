import { Link, useLocation } from "react-router-dom";
import { useApp } from "../../context/AppContext";
import "./AdminLayout.css";

export default function AdminLayout({ children }) {
  const { t } = useApp();
  const location = useLocation();

  const links = [
    { to: "/admin", icon: "chart-pie", label: t("overview") },
    { to: "/admin/organizers", icon: "users", label: t("organizer_management") },
    { to: "/admin/conferences", icon: "calendar-alt", label: t("conferences") },
    { to: "/admin/feedback", icon: "comments", label: t("feedback_management") },
    { to: "/admin/activity", icon: "list-alt", label: t("activity_log") },
  ];

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <i className="fas fa-shield-alt" />
          <span>Admin Panel</span>
        </div>
        <nav className="admin-nav">
          {links.map((l) => (
            <Link key={l.to} to={l.to} className={`admin-nav-link ${location.pathname === l.to ? "active" : ""}`}>
              <i className={`fas fa-${l.icon}`} />
              <span>{l.label}</span>
            </Link>
          ))}
        </nav>
      </aside>
      <main className="admin-main page-wrapper">{children}</main>
    </div>
  );
}
