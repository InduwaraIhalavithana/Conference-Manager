import { useState } from "react";
import { api } from "../services/api";
import "./ConferenceModal.css";

export default function ConferenceModal({ conference, token, onSaved, onClose, t }) {
  const isEdit = !!conference;
  const [form, setForm] = useState({
    title: conference?.title || "",
    description: conference?.description || "",
    date: conference?.date || "",
    time: conference?.time?.slice(0, 5) || "",
    location: conference?.location || "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(""); setSaving(true);
    try {
      const payload = { ...form, time: form.time || null };
      const saved = isEdit
        ? await api.updateConference(conference.id, payload, token)
        : await api.createConference(payload, token);
      onSaved(saved);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box card">
        <div className="modal-header">
          <h2><i className="fas fa-calendar-alt" /> {isEdit ? t("edit_conference") : t("create_conference")}</h2>
          <button className="modal-close" onClick={onClose}><i className="fas fa-times" /></button>
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label className="form-label">{t("conference_title")} *</label>
            <input className="form-input" type="text" value={form.title} onChange={set("title")} required />
          </div>
          <div className="form-group">
            <label className="form-label">{t("conference_description")}</label>
            <textarea className="form-input" rows={3} value={form.description} onChange={set("description")} />
          </div>
          <div className="modal-row">
            <div className="form-group">
              <label className="form-label">{t("conference_date")} *</label>
              <input className="form-input" type="date" value={form.date} onChange={set("date")} required />
            </div>
            <div className="form-group">
              <label className="form-label">{t("conference_time")}</label>
              <input className="form-input" type="time" value={form.time} onChange={set("time")} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">{t("conference_location")}</label>
            <input className="form-input" type="text" value={form.location} onChange={set("location")} placeholder="City, Venue, Online…" />
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>{t("cancel")}</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <span className="spinner" /> : <><i className="fas fa-save" /> {t("save")}</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
