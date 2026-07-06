import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { api } from "../services/api";
import { SkeletonCard } from "../components/Skeleton";
import "./DashboardPage.css";

export default function DashboardPage() {
  const { t, token, user } = useApp();
  const [conferences, setConferences] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.myConferences(token, 1).then((res) => setConferences(res.items)).finally(() => setLoading(false));
  }, [token]);

  const today    = new Date().toISOString().slice(0, 10);
  const upcoming = conferences.filter((c) => c.date >= today);
  const past     = conferences.filter((c) => c.date <  today);
  const totalAttendees = conferences.reduce((s, c) => s + (c.attendee_count || 0), 0);

  const stats = [
    { icon: "calendar-check", label: t("total_confs"),     val: conferences.length, color: "blue"   },
    { icon: "rocket",          label: t("upcoming_confs"), val: upcoming.length,    color: "purple" },
    { icon: "users",           label: t("total_attendees"),val: totalAttendees,     color: "green"  },
    { icon: "history",         label: "Past Events",       val: past.length,        color: "orange" },
  ];

  const quickActions = [
    { icon: "plus-circle",    label: t("create_conference"), to: "/my-conferences", primary: true  },
    { icon: "calendar-alt",   label: t("my_conferences"),    to: "/my-conferences", primary: false },
    { icon: "globe",          label: "Browse Public",        to: "/conferences",    primary: false },
    { icon: "cog",            label: t("settings"),          to: "/settings",       primary: false },
  ];

  return (
    <div className="page-wrapper">
      <div className="container">

        {/* Welcome hero */}
        <div className="dashboard-hero">
          <div className="dashboard-orb" />
          <div className="dashboard-welcome fade-up">
            <div className="dash-welcome-top">
              <div className="dash-avatar">
                {user?.first_name?.[0]?.toUpperCase() || "O"}
              </div>
              <div>
                <h1>Welcome back, {user?.first_name || "Organizer"} 👋</h1>
                <p className="dash-welcome-sub">Here&apos;s your conference overview for today.</p>
              </div>
            </div>
          </div>
          <Link to="/my-conferences" className="btn btn-primary">
            <i className="fas fa-plus" /> {t("create_conference")}
          </Link>
        </div>

        {/* Stat cards */}
        <div className="stat-cards">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="stat-card card">
                <div style={{ height: 40, borderRadius: 8, background: "var(--bg-hover)", animation: "pulse 1.4s ease-in-out infinite" }} />
              </div>
            ))
          ) : stats.map((s) => (
            <div key={s.label} className={`stat-card card dash-stat-${s.color}`}>
              <div className="stat-icon-wrap"><i className={`fas fa-${s.icon}`} /></div>
              <div className="stat-val">{s.val}</div>
              <div className="stat-lbl">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Quick actions */}
        <div className="quick-actions-section">
          <h2 className="dash-section-title">Quick Actions</h2>
          <div className="quick-actions-grid">
            {quickActions.map((a) => (
              <Link key={a.label} to={a.to} className={`quick-action-card card ${a.primary ? "quick-primary" : ""}`}>
                <i className={`fas fa-${a.icon}`} />
                <span>{a.label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Upcoming conferences list */}
        <div className="dashboard-recent">
          <div className="dash-section-header">
            <h2 className="dash-section-title">{t("upcoming_conferences")}</h2>
            <Link to="/my-conferences" className="btn btn-ghost btn-sm">Manage all →</Link>
          </div>

          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : upcoming.length === 0 ? (
            <div className="dash-empty-state card">
              <div className="dash-empty-icon"><i className="fas fa-calendar-plus" /></div>
              <div className="dash-empty-text">
                <h3>No upcoming conferences</h3>
                <p>Create your first conference and start accepting attendee registrations.</p>
              </div>
              <Link to="/my-conferences" className="btn btn-primary">
                <i className="fas fa-plus" /> Create Conference
              </Link>
            </div>
          ) : (
            <div className="dashboard-conf-list">
              {upcoming.slice(0, 5).map((c) => (
                <div key={c.id} className="dash-conf-row card">
                  <div className="dash-conf-color-bar" />
                  <div className="dash-conf-info">
                    <span className="dash-conf-title">{c.title}</span>
                    <span className="dash-conf-meta">
                      <span><i className="fas fa-calendar" /> {new Date(c.date).toLocaleDateString()}</span>
                      {c.location && <span><i className="fas fa-map-marker-alt" /> {c.location}</span>}
                    </span>
                  </div>
                  <div className="dash-conf-actions">
                    <span className="tag"><i className="fas fa-users" /> {c.attendee_count}</span>
                    <Link to={`/attendees/${c.id}`} className="btn btn-ghost btn-sm">
                      <i className="fas fa-users" /> Attendees
                    </Link>
                    <Link to="/my-conferences" className="btn btn-ghost btn-sm">
                      <i className="fas fa-edit" /> Edit
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Past conferences summary (if any) */}
        {!loading && past.length > 0 && (
          <div className="dashboard-recent" style={{ marginTop: 0 }}>
            <div className="dash-section-header">
              <h2 className="dash-section-title">Past Events</h2>
            </div>
            <div className="dashboard-conf-list">
              {past.slice(0, 3).map((c) => (
                <div key={c.id} className="dash-conf-row card past">
                  <div className="dash-conf-color-bar past-bar" />
                  <div className="dash-conf-info">
                    <span className="dash-conf-title">{c.title}</span>
                    <span className="dash-conf-meta">
                      <span><i className="fas fa-calendar" /> {new Date(c.date).toLocaleDateString()}</span>
                      {c.location && <span><i className="fas fa-map-marker-alt" /> {c.location}</span>}
                    </span>
                  </div>
                  <div className="dash-conf-actions">
                    <span className="tag"><i className="fas fa-users" /> {c.attendee_count} attended</span>
                    <span className="badge badge-warning" style={{ fontSize: "0.72rem" }}>Past</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
