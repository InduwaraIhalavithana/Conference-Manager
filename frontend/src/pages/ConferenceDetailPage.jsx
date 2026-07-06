import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import toast from "react-hot-toast";
import { useApp } from "../context/AppContext";
import { api } from "../services/api";
import "./ConferencesPage.css";

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

  const spotsLeft = conf.max_attendees ? conf.max_attendees - (conf.attendee_count || 0) : null;

  return (
    <div className="page-wrapper">
      <div className="container conf-detail">
        <Link to="/conferences" className="back-link"><i className="fas fa-arrow-left" /> {t("back")}</Link>

        <div className="conf-detail-grid">
          <div className="conf-info card">
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
              <h1 className="conf-detail-title" style={{ margin: 0 }}>{conf.title}</h1>
              {conf.category && <span className="tag" style={{ marginTop: 4 }}>{conf.category}</span>}
              {conf.status === "draft" && <span className="badge badge-warning" style={{ marginTop: 4 }}>Draft</span>}
            </div>
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
              <div className="conf-meta-item">
                <i className="fas fa-user-tie" />
                <span>{t("organizer")}: {conf.organizer_name}</span>
              </div>
              <div className="conf-meta-item">
                <i className="fas fa-users" />
                <span>
                  {conf.attendee_count} {t("attendees")}
                  {spotsLeft !== null && (
                    <span style={{ color: spotsLeft <= 5 ? "var(--error)" : "var(--text-muted)", marginLeft: 8 }}>
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
            <h2><i className="fas fa-ticket-alt" /> {t("register_attend")}</h2>
            {success ? (
              <div className="success-msg">
                <i className="fas fa-check-circle" />
                <p>{t("registration_success")}</p>
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
