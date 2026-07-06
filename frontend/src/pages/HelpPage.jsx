import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { useApp } from "../context/AppContext";
import { api } from "../services/api";
import "./HelpPage.css";

const FAQ = [
  { q: "How do I create a conference?", a: "Go to My Conferences → Create Conference. Fill in the title, date, and location." },
  { q: "Can attendees register without an account?", a: "Yes! Attendees register directly on the conference page — no account needed." },
  { q: "How do I view my attendees?", a: "From My Conferences, click the Attendees button next to any conference." },
  { q: "How do I change my password?", a: "Go to Settings → Change Password." },
];

export default function HelpPage() {
  const { t, token } = useApp();
  const [tab, setTab] = useState("faq");
  const [form, setForm] = useState({ subject: "", message: "" });
  const [history, setHistory] = useState([]);
  const [sending, setSending] = useState(false);
  const [openFaq, setOpenFaq] = useState(null);

  useEffect(() => {
    if (tab === "history") {
      api.myFeedback(token).then(setHistory).catch(() => {});
    }
  }, [tab, token]);

  const sendFeedback = async (e) => {
    e.preventDefault(); setSending(true);
    try {
      await api.submitFeedback(form, token);
      toast.success("Feedback sent successfully!");
      setForm({ subject: "", message: "" });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="page-wrapper">
      <div className="container help-layout">
        <aside className="help-sidebar card">
          <h2><i className="fas fa-question-circle" /> {t("help")}</h2>
          <nav className="settings-nav">
            {["faq", "feedback", "history"].map((t_) => (
              <button key={t_} className={`settings-tab ${tab === t_ ? "active" : ""}`} onClick={() => setTab(t_)}>
                <i className={`fas fa-${t_ === "faq" ? "book-open" : t_ === "feedback" ? "paper-plane" : "history"}`} />
                {t_ === "faq" ? "FAQ" : t_ === "feedback" ? t("submit_feedback") : t("feedback_history")}
              </button>
            ))}
          </nav>
        </aside>

        <main className="help-main">
          {tab === "faq" && (
            <div className="card fade-up">
              <h3><i className="fas fa-book-open" /> Frequently Asked Questions</h3>
              <div className="faq-list">
                {FAQ.map((item, i) => (
                  <div key={i} className={`faq-item ${openFaq === i ? "open" : ""}`}>
                    <button className="faq-q" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                      {item.q}
                      <i className={`fas fa-chevron-${openFaq === i ? "up" : "down"}`} />
                    </button>
                    {openFaq === i && <p className="faq-a">{item.a}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "feedback" && (
            <div className="card fade-up">
              <h3><i className="fas fa-paper-plane" /> {t("submit_feedback")}</h3>
              <form onSubmit={sendFeedback} className="settings-form">
                <div className="form-group">
                  <label className="form-label">{t("subject")}</label>
                  <input className="form-input" type="text" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label className="form-label">{t("message")}</label>
                  <textarea className="form-input" rows={5} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} required />
                </div>
                <button className="btn btn-primary" type="submit" disabled={sending}>
                  {sending ? <span className="spinner" /> : <><i className="fas fa-paper-plane" /> {t("send")}</>}
                </button>
              </form>
            </div>
          )}

          {tab === "history" && (
            <div className="card fade-up">
              <h3><i className="fas fa-history" /> {t("feedback_history")}</h3>
              {history.length === 0 ? (
                <p style={{ color: "var(--text-muted)" }}>No feedback submitted yet.</p>
              ) : (
                <div className="fb-list">
                  {history.map((fb) => (
                    <div key={fb.id} className="fb-item">
                      <div className="fb-head">
                        <span className="fb-subject">{fb.subject}</span>
                        <span className={`badge badge-${fb.status === "resolved" ? "success" : "warning"}`}>
                          {t(fb.status === "resolved" ? "status_resolved" : "status_open")}
                        </span>
                      </div>
                      <p className="fb-msg">{fb.message}</p>
                      {fb.reply && (
                        <div className="fb-reply">
                          <span className="fb-reply-label"><i className="fas fa-reply" /> {t("admin_reply")}</span>
                          <p>{fb.reply}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
