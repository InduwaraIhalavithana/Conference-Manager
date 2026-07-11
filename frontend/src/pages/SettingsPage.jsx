import { useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useApp } from "../context/AppContext";
import { api } from "../services/api";
import CustomSelect from "../components/CustomSelect";
import ConfirmModal from "../components/ConfirmModal";
import "./SettingsPage.css";

export default function SettingsPage() {
  const { t, token, user, lang, setLang, theme, toggleTheme, updateUser, logout } = useApp();
  const navigate = useNavigate();
  const [tab, setTab] = useState("profile");
  const [profile, setProfile] = useState({ first_name: user?.first_name || "", last_name: user?.last_name || "", phone: user?.phone || "" });
  const [pwd, setPwd] = useState({ current_password: "", new_password: "", confirm: "" });
  const [deletePassword, setDeletePassword] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      await api.deleteAccount({ password: deletePassword }, token);
      logout();
      navigate("/");
    } catch (err) {
      toast.error(err.message);
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  };

  const saveProfile = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      const updated = await api.updateProfile({ first_name: profile.first_name, last_name: profile.last_name, phone: profile.phone }, token);
      updateUser(updated);
      toast.success("Profile updated successfully.");
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    if (pwd.new_password !== pwd.confirm) { toast.error("Passwords do not match."); return; }
    setSaving(true);
    try {
      await api.changePassword({ current_password: pwd.current_password, new_password: pwd.new_password }, token);
      toast.success("Password changed successfully.");
      setPwd({ current_password: "", new_password: "", confirm: "" });
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="page-wrapper">
      <div className="container settings-layout">
        <aside className="settings-sidebar card">
          <h2><i className="fas fa-cog" /> {t("settings")}</h2>
          <nav className="settings-nav">
            {["profile", "password", "appearance", "danger"].map((tab_) => (
              <button
                key={tab_}
                className={`settings-tab ${tab === tab_ ? "active" : ""} ${tab_ === "danger" ? "settings-tab-danger" : ""}`}
                onClick={() => setTab(tab_)}
              >
                <i className={`fas fa-${tab_ === "profile" ? "user" : tab_ === "password" ? "lock" : tab_ === "appearance" ? "palette" : "exclamation-triangle"}`} />
                {tab_ === "password" ? t("change_password") : tab_ === "appearance" ? t("appearance") : tab_ === "danger" ? "Danger Zone" : t("profile")}
              </button>
            ))}
          </nav>
        </aside>

        <main className="settings-main">
          {tab === "profile" && (
            <div className="card fade-up">
              <h3><i className="fas fa-user" /> {t("profile")}</h3>
              <form onSubmit={saveProfile} className="settings-form">
                <div className="auth-row">
                  <div className="form-group">
                    <label className="form-label">{t("first_name")}</label>
                    <input className="form-input" value={profile.first_name} onChange={(e) => setProfile({ ...profile, first_name: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">{t("last_name")}</label>
                    <input className="form-input" value={profile.last_name} onChange={(e) => setProfile({ ...profile, last_name: e.target.value })} required />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">{t("phone")}</label>
                  <input className="form-input" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">{t("email")}</label>
                  <input className="form-input" value={user?.email || ""} disabled style={{ opacity: 0.5 }} />
                </div>
                <button className="btn btn-primary" type="submit" disabled={saving}>
                  {saving ? <span className="spinner" /> : <><i className="fas fa-save" /> {t("save_changes")}</>}
                </button>
              </form>
            </div>
          )}

          {tab === "password" && (
            <div className="card fade-up">
              <h3><i className="fas fa-lock" /> {t("change_password")}</h3>
              <form onSubmit={savePassword} className="settings-form">
                <div className="form-group">
                  <label className="form-label">{t("current_password")}</label>
                  <input className="form-input" type="password" value={pwd.current_password} onChange={(e) => setPwd({ ...pwd, current_password: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label className="form-label">{t("new_password")}</label>
                  <input className="form-input" type="password" value={pwd.new_password} onChange={(e) => setPwd({ ...pwd, new_password: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label className="form-label">{t("confirm_password")}</label>
                  <input className="form-input" type="password" value={pwd.confirm} onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })} required />
                </div>
                <button className="btn btn-primary" type="submit" disabled={saving}>
                  {saving ? <span className="spinner" /> : <><i className="fas fa-key" /> {t("save_changes")}</>}
                </button>
              </form>
            </div>
          )}

          {tab === "danger" && (
            <div className="card fade-up" style={{ borderColor: "var(--error)", borderWidth: 1, borderStyle: "solid" }}>
              <h3 style={{ color: "var(--error)" }}><i className="fas fa-exclamation-triangle" /> Delete Account</h3>
              <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", marginBottom: 16 }}>
                Permanently deletes your account and all associated conferences, attendees, and data. This action cannot be undone.
              </p>
              <form onSubmit={(e) => { e.preventDefault(); setConfirmDelete(true); }} className="settings-form">
                <div className="form-group">
                  <label className="form-label">Confirm your password</label>
                  <input
                    className="form-input"
                    type="password"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    required
                    placeholder="Enter your password to confirm"
                  />
                </div>
                <button className="btn btn-danger" type="submit" disabled={deleting}>
                  {deleting ? <span className="spinner" /> : <><i className="fas fa-trash" /> Delete My Account</>}
                </button>
              </form>
            </div>
          )}

          {confirmDelete && (
            <ConfirmModal
              danger
              title="Delete your account?"
              message="Your account and every conference, attendee list, and record tied to it will be permanently erased. This cannot be undone."
              confirmLabel="Delete forever"
              busy={deleting}
              onConfirm={handleDeleteAccount}
              onCancel={() => setConfirmDelete(false)}
            />
          )}

          {tab === "appearance" && (
            <div className="card fade-up">
              <h3><i className="fas fa-palette" /> {t("appearance")}</h3>
              <div className="appearance-opts">
                <div className="appear-row">
                  <div>
                    <div className="appear-label">{t(theme === "dark" ? "dark_mode" : "light_mode")}</div>
                    <div className="appear-desc" style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>Toggle between dark and light themes</div>
                  </div>
                  <button className="btn btn-ghost" onClick={toggleTheme}>
                    <i className={`fas fa-${theme === "dark" ? "sun" : "moon"}`} />
                    {t(theme === "dark" ? "light_mode" : "dark_mode")}
                  </button>
                </div>
                <div className="appear-row">
                  <div>
                    <div className="appear-label">{t("language")}</div>
                    <div className="appear-desc" style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>Choose your preferred language</div>
                  </div>
                  <CustomSelect style={{ width: 160 }} value={lang} onChange={(e) => setLang(e.target.value)}>
                    <option value="en">English</option>
                    <option value="si">සිංහල</option>
                    <option value="ta">தமிழ்</option>
                  </CustomSelect>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
