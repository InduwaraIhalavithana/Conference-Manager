import { useState, useEffect } from "react";
import { useApp } from "../../context/AppContext";
import { api } from "../../services/api";
import AdminLayout from "./AdminLayout";
import "./AdminPages.css";

export default function AdminDashboardPage() {
  const { t, token } = useApp();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.adminStats(token).then(setStats).finally(() => setLoading(false));
  }, [token]);

  const cards = stats ? [
    { icon: "users",        label: t("total_organizers"),  val: stats.total_organizers, color: "accent"  },
    { icon: "user-check",   label: t("active_organizers"), val: stats.active_organizers,color: "success" },
    { icon: "user-slash",   label: t("suspended"),         val: stats.suspended,         color: "danger"  },
    { icon: "calendar-alt", label: t("total_confs"),       val: stats.total_confs,       color: "info"    },
    { icon: "rocket",       label: t("upcoming_confs"),    val: stats.upcoming_confs,    color: "info"    },
    { icon: "users",        label: t("total_attendees"),   val: stats.total_attendees,   color: "success" },
    { icon: "comments",     label: t("open_feedback"),     val: stats.open_feedback,     color: "warning" },
  ] : [];

  return (
    <AdminLayout>
      <div className="container">
        {/* Admin welcome banner */}
        <div className="admin-welcome-banner">
          <div className="admin-welcome-orb" />
          <div className="admin-welcome-content">
            <div className="admin-welcome-icon">
              <i className="fas fa-shield-alt" />
            </div>
            <div>
              <h1>Admin Dashboard</h1>
              <p>System overview and management controls</p>
            </div>
          </div>
          <div className="admin-welcome-badge">
            <i className="fas fa-circle" style={{ color: "var(--success)", fontSize: "0.5rem" }} />
            System Online
          </div>
        </div>

        <div className="admin-page-header" style={{ marginTop: 0 }}>
          <h1><i className="fas fa-chart-pie" /> {t("overview")}</h1>
        </div>

        {loading ? (
          <div className="center-spinner"><span className="spinner" /></div>
        ) : (
          <div className="admin-stat-grid">
            {cards.map((c) => (
              <div key={c.label} className={`admin-stat-card card color-${c.color}`}>
                <div className="admin-stat-icon"><i className={`fas fa-${c.icon}`} /></div>
                <div className="admin-stat-val">{c.val}</div>
                <div className="admin-stat-lbl">{c.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
