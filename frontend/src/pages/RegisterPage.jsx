import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { api } from "../services/api";
import "./AuthPage.css";

export default function RegisterPage() {
  const { t, login, token } = useApp();
  const navigate = useNavigate();
  const [form, setForm] = useState({ first_name: "", last_name: "", email: "", phone: "", password: "", confirm: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (token) navigate("/dashboard"); }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirm) { setError("Passwords do not match"); return; }
    setError(""); setLoading(true);
    try {
      const res = await api.register({ first_name: form.first_name, last_name: form.last_name, email: form.email, phone: form.phone, password: form.password });
      const me = await api.getMe(res.access_token);
      login(res.access_token, me, "organizer");
      navigate("/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="auth-split-page">
      {/* Left panel */}
      <div className="auth-left-panel">
        <div className="auth-left-orb auth-left-orb-1" />
        <div className="auth-left-orb auth-left-orb-2" />
        <Link to="/" className="auth-left-brand">
          <i className="fas fa-calendar-alt" /> ConferenceHub
        </Link>
        <div className="auth-left-content">
          <h2>Start managing conferences today</h2>
          <p>Create your free organizer account and publish your first conference in minutes.</p>
          <div className="auth-left-features">
            {[
              { icon: "rocket",         text: "Get started in seconds — it's free" },
              { icon: "calendar-plus",  text: "Create and publish conferences" },
              { icon: "users",          text: "Let attendees register instantly" },
              { icon: "shield-alt",     text: "Secure, reliable, always available" },
            ].map((f) => (
              <div key={f.icon} className="auth-left-feature">
                <i className={`fas fa-${f.icon}`} />
                <span>{f.text}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="auth-left-footer">© 2026 ConferenceHub. All rights reserved.</div>
      </div>

      {/* Right panel */}
      <div className="auth-right-panel">
        <div className="auth-right-inner fade-up">
          <div className="auth-header">
            <h1>{t("sign_up")}</h1>
            <p className="auth-sub">Create your organizer account — free forever</p>
          </div>
          {error && <div className="alert alert-error">{error}</div>}
          <form onSubmit={handleSubmit} className="auth-form">
            <div className="auth-row">
              <div className="form-group">
                <label className="form-label">{t("first_name")}</label>
                <input className="form-input" type="text" value={form.first_name} onChange={set("first_name")} required placeholder="John" />
              </div>
              <div className="form-group">
                <label className="form-label">{t("last_name")}</label>
                <input className="form-input" type="text" value={form.last_name} onChange={set("last_name")} required placeholder="Doe" />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">{t("email")}</label>
              <input className="form-input" type="email" value={form.email} onChange={set("email")} required placeholder="you@example.com" />
            </div>
            <div className="form-group">
              <label className="form-label">{t("phone")} <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(optional)</span></label>
              <input className="form-input" type="tel" value={form.phone} onChange={set("phone")} placeholder="+94 7X XXX XXXX" />
            </div>
            <div className="auth-row">
              <div className="form-group">
                <label className="form-label">{t("password")}</label>
                <input className="form-input" type="password" value={form.password} onChange={set("password")} required placeholder="••••••••" />
              </div>
              <div className="form-group">
                <label className="form-label">{t("confirm_password")}</label>
                <input className="form-input" type="password" value={form.confirm} onChange={set("confirm")} required placeholder="••••••••" />
              </div>
            </div>
            <button className="btn btn-primary auth-submit" type="submit" disabled={loading}>
              {loading ? <span className="spinner" /> : <><i className="fas fa-user-plus" /> {t("sign_up")}</>}
            </button>
          </form>
          <p className="auth-switch">
            {t("have_account")} <Link to="/login">{t("sign_in")}</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
