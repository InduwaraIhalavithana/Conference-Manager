import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { api } from "../services/api";
import { SkeletonCard } from "../components/Skeleton";
import { actionMeta, relTime } from "../utils/activity";
import "./DashboardPage.css";

/* Animated count-up number */
function CountUp({ value, duration = 900 }) {
  const [display, setDisplay] = useState(0);
  const raf = useRef(null);
  useEffect(() => {
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(eased * value));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [value, duration]);
  return <>{display}</>;
}

/* Pure-SVG 14-day registration sparkline */
function Sparkline({ trend }) {
  if (!trend || trend.length === 0) return null;
  const W = 560, H = 120, PAD = 8;
  const max = Math.max(...trend.map((d) => d.count), 1);
  const stepX = (W - PAD * 2) / (trend.length - 1);
  const pts = trend.map((d, i) => ({
    x: PAD + i * stepX,
    y: H - PAD - (d.count / max) * (H - PAD * 2 - 14),
  }));
  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const area = `${line} L${pts[pts.length - 1].x},${H - PAD} L${pts[0].x},${H - PAD} Z`;
  const totalRegs = trend.reduce((s, d) => s + d.count, 0);
  return (
    <div className="dash-spark card">
      <div className="dash-spark-head">
        <div>
          <div className="dash-spark-title"><i className="fas fa-chart-line" /> Registrations</div>
          <div className="dash-spark-sub">last 14 days</div>
        </div>
        <div className="dash-spark-total">{totalRegs}</div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="dash-spark-svg" preserveAspectRatio="none">
        <defs>
          <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#sparkFill)" />
        <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" className="spark-line" />
        {pts.map((p, i) =>
          trend[i].count > 0 ? (
            <circle key={i} cx={p.x} cy={p.y} r="3.5" fill="var(--accent)">
              <title>{trend[i].date}: {trend[i].count}</title>
            </circle>
          ) : null
        )}
      </svg>
      <div className="dash-spark-axis">
        <span>{trend[0].date.slice(5)}</span>
        <span>{trend[trend.length - 1].date.slice(5)}</span>
      </div>
    </div>
  );
}

/* Next-event countdown card */
function NextEvent({ conf }) {
  if (!conf) return null;
  const days = Math.max(0, Math.ceil((new Date(conf.date + "T00:00:00") - new Date()) / 86400000));
  const pct = conf.max_attendees ? Math.min(100, Math.round((conf.attendee_count / conf.max_attendees) * 100)) : null;
  return (
    <div className="dash-next card">
      <div className="dash-next-badge"><i className="fas fa-hourglass-half" /> Next event</div>
      <div className="dash-next-days">
        <span className="dash-next-num"><CountUp value={days} /></span>
        <span className="dash-next-unit">{days === 1 ? "day" : "days"} to go</span>
      </div>
      <div className="dash-next-title">{conf.title}</div>
      <div className="dash-next-meta">
        <i className="fas fa-calendar" /> {new Date(conf.date).toLocaleDateString()}
        {conf.location && <>&nbsp;&nbsp;<i className="fas fa-map-marker-alt" /> {conf.location}</>}
      </div>
      {pct !== null && (
        <div className="dash-next-cap">
          <div className="dash-next-cap-bar"><div style={{ width: `${pct}%` }} /></div>
          <span>{conf.attendee_count}/{conf.max_attendees} registered</span>
        </div>
      )}
      <Link to={`/attendees/${conf.id}`} className="btn btn-ghost btn-sm" style={{ marginTop: 12 }}>
        <i className="fas fa-users" /> View attendees
      </Link>
    </div>
  );
}

function ActivityFeed({ items }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="dash-activity card">
      <div className="dash-spark-title" style={{ marginBottom: 14 }}><i className="fas fa-stream" /> Recent Activity</div>
      <div className="dash-activity-list">
        {items.map((a, i) => {
          const meta = actionMeta(a.action);
          return (
            <div key={i} className="dash-activity-row" style={{ animationDelay: `${i * 50}ms` }}>
              <span className={`dash-act-icon act-${meta.color}`}><i className={`fas fa-${meta.icon}`} /></span>
              <span className="dash-act-text">
                {a.action.replace(/_/g, " ")}
                {a.target && <span className="dash-act-target"> · {a.target}</span>}
              </span>
              <span className="dash-act-time">{relTime(a.created_at)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { t, token, user } = useApp();
  const [conferences, setConferences] = useState([]);
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.myConferences(token, 1).then((res) => setConferences(res.items)),
      api.myOverview(token).then(setOverview).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, [token]);

  const today    = new Date().toISOString().slice(0, 10);
  const upcoming = conferences.filter((c) => c.date >= today).sort((a, b) => a.date.localeCompare(b.date));
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
        <div className="dashboard-hero fade-up-stagger" style={{ "--stagger": 0 }}>
          <div className="dashboard-orb" />
          <div className="dashboard-welcome">
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
          ) : stats.map((s, i) => (
            <div key={s.label} className={`stat-card card dash-stat-${s.color} fade-up-stagger`} style={{ "--stagger": i + 1 }}>
              <div className="stat-icon-wrap"><i className={`fas fa-${s.icon}`} /></div>
              <div className="stat-val"><CountUp value={s.val} /></div>
              <div className="stat-lbl">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Trend + Next event row */}
        {!loading && (overview?.trend || upcoming.length > 0) && (
          <div className="dash-insight-row">
            {overview?.trend && (
              <div className="fade-up-stagger" style={{ "--stagger": 5, flex: 2, minWidth: 280 }}>
                <Sparkline trend={overview.trend} />
              </div>
            )}
            {upcoming.length > 0 && (
              <div className="fade-up-stagger" style={{ "--stagger": 6, flex: 1, minWidth: 240 }}>
                <NextEvent conf={upcoming[0]} />
              </div>
            )}
          </div>
        )}

        {/* Quick actions */}
        <div className="quick-actions-section">
          <h2 className="dash-section-title">Quick Actions</h2>
          <div className="quick-actions-grid">
            {quickActions.map((a, i) => (
              <Link key={a.label} to={a.to} className={`quick-action-card card fade-up-stagger ${a.primary ? "quick-primary" : ""}`} style={{ "--stagger": i + 7 }}>
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

        {/* Activity feed */}
        {!loading && <ActivityFeed items={overview?.activity} />}

        {/* Past conferences summary (if any) */}
        {!loading && past.length > 0 && (
          <div className="dashboard-recent" style={{ marginTop: 24 }}>
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
