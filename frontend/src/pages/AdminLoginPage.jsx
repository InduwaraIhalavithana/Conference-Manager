import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { api } from "../services/api";
import "./AuthPage.css";

export default function AdminLoginPage() {
  const { t, login, token, role } = useApp();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (token && role === "admin") navigate("/admin"); }, [token, role]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const res = await api.adminLogin(form);
      const me = await api.getAdminMe(res.access_token);
      login(res.access_token, me, "admin");
      navigate("/admin");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page page-wrapper">
      <div className="auth-orb auth-orb-1" />
      <div className="auth-card card fade-up">
        <div className="auth-header">
          <i className="fas fa-shield-alt auth-icon" style={{ color: "var(--warning)" }} />
          <h1>{t("admin_login")}</h1>
          <p className="auth-sub">Administrator access only</p>
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label className="form-label">{t("username")}</label>
            <input className="form-input" type="text" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
          </div>
          <div className="form-group">
            <label className="form-label">{t("password")}</label>
            <input className="form-input" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          </div>
          <button className="btn btn-primary auth-submit" type="submit" disabled={loading} style={{ background: "linear-gradient(135deg, var(--warning), #d97706)" }}>
            {loading ? <span className="spinner" /> : <><i className="fas fa-lock" /> {t("sign_in")}</>}
          </button>
        </form>
      </div>
    </div>
  );
}
