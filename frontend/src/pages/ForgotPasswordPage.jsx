import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../services/api";
import "./AuthPage.css";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const res = await api.forgotPassword({ email });
      setMsg(res.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-split-page">
      <div className="auth-left-panel">
        <div className="auth-left-orb auth-left-orb-1" />
        <div className="auth-left-orb auth-left-orb-2" />
        <Link to="/" className="auth-left-brand"><i className="fas fa-calendar-alt" /> ConferenceHub</Link>
        <div className="auth-left-content">
          <h2>Reset Your Password</h2>
          <p>Enter your email address and we&apos;ll send you a link to reset your password.</p>
        </div>
        <div className="auth-left-footer">© 2026 ConferenceHub. All rights reserved.</div>
      </div>

      <div className="auth-right-panel">
        <div className="auth-right-inner fade-up">
          <div className="auth-header">
            <h1>Forgot Password</h1>
            <p className="auth-sub">We&apos;ll help you get back in</p>
          </div>
          {error && <div className="alert alert-error">{error}</div>}
          {msg ? (
            <div className="alert alert-success" style={{ marginBottom: 16 }}>
              {msg}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="auth-form">
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input
                  className="form-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                />
              </div>
              <button className="btn btn-primary auth-submit" type="submit" disabled={loading}>
                {loading ? <span className="spinner" /> : <><i className="fas fa-paper-plane" /> Send Reset Link</>}
              </button>
            </form>
          )}
          <p className="auth-switch"><Link to="/login">← Back to Login</Link></p>
        </div>
      </div>
    </div>
  );
}
