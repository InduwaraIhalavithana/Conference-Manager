import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import toast from "react-hot-toast";
import { useApp } from "../context/AppContext";
import { api } from "../services/api";
import { catMeta, countdownLabel } from "../utils/categories";
import { avatarColor, initials } from "../utils/avatars";
import "./ConferencesPage.css";
import "./ConferenceDetailPage.css";

/* Animated spots-left ring */
function SpotsRing({ taken, max, color }) {
  const R = 26, C = 2 * Math.PI * R;
  const pct = Math.min(1, taken / max);
  return (
    <div className="spots-ring-wrap">
      <svg viewBox="0 0 64 64" className="spots-ring">
        <circle cx="32" cy="32" r={R} fill="none" stroke="var(--bg-hover)" strokeWidth="6" />
        <circle
          cx="32" cy="32" r={R} fill="none"
          stroke={color} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - pct)}
          transform="rotate(-90 32 32)"
          className="spots-ring-fill"
        />
      </svg>
      <div className="spots-ring-label">
        <span className="spots-ring-num">{max - taken}</span>
        <span className="spots-ring-sub">left</span>
      </div>
    </div>
  );
}

/* CSS confetti burst */
function Confetti() {
  const pieces = Array.from({ length: 24 });
  const colors = ["#00a8ff", "#10b981", "#a855f7", "#f59e0b", "#ef4444", "#06b6d4"];
  return (
    <div className="confetti-wrap" aria-hidden="true">
      {pieces.map((_, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={{
            left: `${(i / 24) * 100}%`,
            background: colors[i % colors.length],
            animationDelay: `${(i % 8) * 60}ms`,
            animationDuration: `${900 + (i % 5) * 150}ms`,
          }}
        />
      ))}
    </div>
  );
}

export default function ConferenceDetailPage() {
  const { id } = useParams();
  const { t } = useApp();
  const [conf, setConf] = useState(null);
  const [form, setForm] = useState({ name: "", email: "" });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getConference(id).then(setConf).finally(() => setLoading(false));
  }, [id]);

  const handleRegister = async (e) => {
    e.preventDefault();
    setError(""); setSubmitting(true);
    try {
      await api.registerAttendee(id, form);
      setSuccess(true);
      setConf((prev) => ({ ...prev, attendee_count: (prev.attendee_count || 0) + 1 }));
      toast.success("You are registered!");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="page-wrapper center-spinner"><span className="spinner" /></div>;
  if (!conf) return <div className="page-wrapper"><p>Conference not found.</p></div>;

  const m = catMeta(conf.category);
  const countdown = countdownLabel(conf.date);
  const spotsLeft = conf.max_attendees ? conf.max_attendees - (conf.attendee_count || 0) : null;

  return (
    <div className="page-wrapper">
      <div className="container conf-detail" style={{ "--cat": m.color, "--cat-soft": m.soft }}>
        <Link to="/conferences" className="back-link"><i className="fas fa-arrow-left" /> {t("back")}</Link>

        <div className="conf-detail-grid">
          <div className="conf-info card detail-hero">
            <div className="detail-hero-accent" />
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
              {conf.category && (
                <span className="conf-cat-tag" style={{ background: m.soft, color: m.color }}>
                  <i className={`fas fa-${m.icon}`} /> {conf.category}
                </span>
              )}
              {countdown && <span className="conf-countdown-chip">{countdown}</span>}
              {conf.status === "draft" && <span className="badge badge-warning">Draft</span>}
            </div>
            <h1 className="conf-detail-title">{conf.title}</h1>
            <div className="conf-meta-list">
              <div className="conf-meta-item">
                <i className="fas fa-calendar" />
                <span>{new Date(conf.date).toLocaleDateString("en-GB", { weekday:"long", year:"numeric", month:"long", day:"numeric" })}</span>
              </div>
              {conf.time && (
                <div className="conf-meta-item">
                  <i className="fas fa-clock" />
                  <span>{conf.time.slice(0,5)}</span>
                </div>
              )}
              <div className="conf-meta-item">
                <i className="fas fa-map-marker-alt" />
                <span>{conf.location || "To be announced"}</span>
              </div>
              <div className="conf-meta-item detail-organizer">
                <span className="att-avatar detail-org-avatar" style={{ background: avatarColor(conf.organizer_name || "?") }}>
                  {initials(conf.organizer_name || "?")}
                </span>
                <span>{t("organizer")}: <strong>{conf.organizer_name}</strong></span>
              </div>
              <div className="conf-meta-item">
                <i className="fas fa-users" />
                <span>
                  {conf.attendee_count} {t("attendees")}
                  {spotsLeft !== null && (
                    <span style={{ color: spotsLeft <= 5 ? "var(--danger)" : "var(--text-muted)", marginLeft: 8 }}>
                      ({spotsLeft > 0 ? `${spotsLeft} spots left` : "Full"})
                    </span>
                  )}
                </span>
              </div>
            </div>
            {conf.description && (
              <div className="conf-description">
                <h3>About</h3>
                <p>{conf.description}</p>
              </div>
            )}
          </div>

          <div className="register-card card">
            {spotsLeft !== null && spotsLeft > 0 && !success && (
              <div className="register-ring-row">
                <SpotsRing taken={conf.attendee_count || 0} max={conf.max_attendees} color={m.color} />
                <div className="register-ring-text">
                  <strong>{spotsLeft}</strong> of {conf.max_attendees} spots remaining
                </div>
              </div>
            )}
            <h2><i className="fas fa-ticket-alt" /> {t("register_attend")}</h2>
            {success ? (
              <div className="ticket-success">
                <Confetti />
                <div className="ticket-card" style={{ "--cat": m.color }}>
                  <div className="ticket-punch ticket-punch-l" />
                  <div className="ticket-punch ticket-punch-r" />
                  <div className="ticket-head">
                    <i className="fas fa-check-circle" />
                    <span>You&apos;re in!</span>
                  </div>
                  <div className="ticket-title">{conf.title}</div>
                  <div className="ticket-divider" />
                  <div className="ticket-meta">
                    <span><i className="fas fa-user" /> {form.name}</span>
                    <span><i className="fas fa-calendar" /> {new Date(conf.date).toLocaleDateString()}</span>
                    {conf.location && <span><i className="fas fa-map-marker-alt" /> {conf.location}</span>}
                  </div>
                  <div className="ticket-note">A confirmation email is on its way to {form.email}</div>
                </div>
              </div>
            ) : spotsLeft === 0 ? (
              <div className="alert alert-error">This conference is full.</div>
            ) : (
              <form onSubmit={handleRegister} className="auth-form">
                {error && <div className="alert alert-error">{error}</div>}
                <div className="form-group">
                  <label className="form-label">{t("your_name")}</label>
                  <input className="form-input" type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label className="form-label">{t("your_email")}</label>
                  <input className="form-input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
                </div>
                <button className="btn btn-primary" type="submit" style={{ width:"100%", justifyContent:"center" }} disabled={submitting}>
                  {submitting ? <span className="spinner" /> : <><i className="fas fa-check" /> {t("register_now")}</>}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
