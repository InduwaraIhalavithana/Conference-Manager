import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { api } from "../services/api";
import "./AuthPage.css";

export default function LoginPage() {
  const { t, login, token } = useApp();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (token) navigate("/dashboard"); }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.login(form);
      const me = await api.getMe(res.access_token);
      login(res.access_token, me, "organizer");
      navigate("/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

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
          <h2>Welcome back to ConferenceHub</h2>
          <p>Sign in to manage your conferences, track attendees, and grow your events.</p>
          <div className="auth-left-features">
            {[
              { icon: "calendar-check", text: "Manage unlimited conferences" },
              { icon: "users",          text: "Track attendees in real time" },
              { icon: "chart-bar",      text: "View your dashboard analytics" },
              { icon: "comments",       text: "Submit feedback to admins" },
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
            <h1>{t("sign_in")}</h1>
            <p className="auth-sub">Enter your credentials to continue</p>
          </div>
          {error && <div className="alert alert-error">{error}</div>}
          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label className="form-label">{t("email")}</label>
              <input
                className="form-input"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
                placeholder="you@example.com"
              />
            </div>
            <div className="form-group">
              <label className="form-label">{t("password")}</label>
              <input
                className="form-input"
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
                placeholder="••••••••"
              />
            </div>
            <button className="btn btn-primary auth-submit" type="submit" disabled={loading}>
              {loading ? <span className="spinner" /> : <><i className="fas fa-sign-in-alt" /> {t("sign_in")}</>}
            </button>
          </form>
          <p className="auth-switch">
            {t("no_account")} <Link to="/register">{t("register")}</Link>
          </p>
          <p className="auth-switch">
            <Link to="/forgot-password">Forgot your password?</Link>
          </p>
          <p className="auth-switch">
            <Link to="/admin/login">{t("admin_login")}</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
