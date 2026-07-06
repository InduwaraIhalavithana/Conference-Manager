import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../services/api";
import "./AuthPage.css";

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token") || "";
  const [form, setForm] = useState({ new_password: "", confirm: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.new_password !== form.confirm) { setError("Passwords do not match."); return; }
    setError(""); setLoading(true);
    try {
      await api.resetPassword({ token, new_password: form.new_password });
      navigate("/login?reset=1");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="page-wrapper"><div className="container">
        <div className="alert alert-error">Invalid reset link. <Link to="/forgot-password">Request a new one.</Link></div>
      </div></div>
    );
  }

  return (
    <div className="auth-split-page">
      <div className="auth-left-panel">
        <div className="auth-left-orb auth-left-orb-1" />
        <div className="auth-left-orb auth-left-orb-2" />
        <Link to="/" className="auth-left-brand"><i className="fas fa-calendar-alt" /> ConferenceHub</Link>
        <div className="auth-left-content">
          <h2>Set a New Password</h2>
          <p>Choose a strong password with at least 8 characters.</p>
        </div>
        <div className="auth-left-footer">© 2026 ConferenceHub. All rights reserved.</div>
      </div>

      <div className="auth-right-panel">
        <div className="auth-right-inner fade-up">
          <div className="auth-header">
            <h1>Reset Password</h1>
            <p className="auth-sub">Enter your new password below</p>
          </div>
          {error && <div className="alert alert-error">{error}</div>}
          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label className="form-label">New Password</label>
              <input
                className="form-input"
                type="password"
                value={form.new_password}
                onChange={(e) => setForm({ ...form, new_password: e.target.value })}
                required
                minLength={8}
                placeholder="Min 8 characters"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Confirm Password</label>
              <input
                className="form-input"
                type="password"
                value={form.confirm}
                onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                required
                placeholder="Repeat your new password"
              />
            </div>
            <button className="btn btn-primary auth-submit" type="submit" disabled={loading}>
              {loading ? <span className="spinner" /> : <><i className="fas fa-key" /> Reset Password</>}
            </button>
          </form>
          <p className="auth-switch"><Link to="/login">← Back to Login</Link></p>
        </div>
      </div>
    </div>
  );
}
