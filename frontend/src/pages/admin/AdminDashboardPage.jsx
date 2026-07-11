import { useState, useEffect } from "react";
import { useApp } from "../../context/AppContext";
import { api } from "../../services/api";
import AdminLayout from "./AdminLayout";
import "./AdminPages.css";
import "./AdminCharts.css";

/* Bar chart: last-14-days counts, pure SVG */
function TrendBars({ data, color, label }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  const total = data.reduce((s, d) => s + d.count, 0);
  return (
    <div className="admin-chart card">
      <div className="admin-chart-head">
        <span className="admin-chart-title">{label}</span>
        <span className="admin-chart-total" style={{ color }}>{total}</span>
      </div>
      <div className="admin-chart-bars">
        {data.map((d, i) => (
          <div key={i} className="admin-chart-col" title={`${d.date}: ${d.count}`}>
            <div
              className="admin-chart-bar"
              style={{ height: `${Math.max(4, (d.count / max) * 100)}%`, background: color, opacity: d.count === 0 ? 0.2 : 1, animationDelay: `${i * 35}ms` }}
            />
          </div>
        ))}
      </div>
      <div className="admin-chart-axis">
        <span>{data[0].date.slice(5)}</span>
        <span>{data[data.length - 1].date.slice(5)}</span>
      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  const { t, token } = useApp();
  const [stats, setStats] = useState(null);
  const [trends, setTrends] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.adminStats(token).then(setStats),
      api.adminTrends(token).then(setTrends).catch(() => {}),
    ]).finally(() => setLoading(false));
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
          <>
            <div className="admin-stat-grid">
              {cards.map((c) => (
                <div key={c.label} className={`admin-stat-card card color-${c.color}`}>
                  <div className="admin-stat-icon"><i className={`fas fa-${c.icon}`} /></div>
                  <div className="admin-stat-val">{c.val}</div>
                  <div className="admin-stat-lbl">{c.label}</div>
                </div>
              ))}
            </div>

            {trends && (
              <div className="admin-chart-row">
                <TrendBars data={trends.registrations} color="var(--accent)" label="Registrations (14d)" />
                <TrendBars data={trends.organizers} color="#a855f7" label="New Organizers (14d)" />
              </div>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  );
}
