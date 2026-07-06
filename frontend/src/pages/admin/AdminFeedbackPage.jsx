import { useState, useEffect } from "react";
import { useApp } from "../../context/AppContext";
import { api } from "../../services/api";
import AdminLayout from "./AdminLayout";
import "./AdminPages.css";

export default function AdminFeedbackPage() {
  const { t, token } = useApp();
  const [feedback, setFeedback] = useState([]);
  const [loading, setLoading] = useState(true);
  const [replyForm, setReplyForm] = useState({});
  const [acting, setActing] = useState(null);

  useEffect(() => {
    api.adminFeedback(token).then(setFeedback).finally(() => setLoading(false));
  }, [token]);

  const sendReply = async (id) => {
    const reply = replyForm[id];
    if (!reply?.trim()) return;
    setActing(id);
    await api.replyFeedback(id, { reply }, token);
    setFeedback((prev) => prev.map((f) => f.id === id ? { ...f, reply } : f));
    setActing(null);
  };

  const resolve = async (id) => {
    setActing(id);
    await api.resolveFeedback(id, token);
    setFeedback((prev) => prev.map((f) => f.id === id ? { ...f, status: "resolved" } : f));
    setActing(null);
  };

  return (
    <AdminLayout>
      <div className="container">
        <div className="admin-page-header">
          <h1><i className="fas fa-comments" /> {t("feedback_management")}</h1>
        </div>
        {loading ? (
          <div className="center-spinner"><span className="spinner" /></div>
        ) : feedback.length === 0 ? (
          <div className="empty-state"><i className="fas fa-inbox" /><p>No feedback yet.</p></div>
        ) : (
          <div className="feedback-list">
            {feedback.map((fb) => (
              <div key={fb.id} className="feedback-item card">
                <div className="fb-admin-head">
                  <div>
                    <span className="fb-subject">{fb.subject}</span>
                    <span className="fb-from">{fb.organizer_name} · {fb.organizer_email}</span>
                  </div>
                  <span className={`badge badge-${fb.status === "resolved" ? "success" : "warning"}`}>
                    {t(fb.status === "resolved" ? "status_resolved" : "status_open")}
                  </span>
                </div>
                <p className="fb-msg">{fb.message}</p>

                {fb.reply && (
                  <div className="fb-reply">
                    <span className="fb-reply-label"><i className="fas fa-reply" /> Your reply</span>
                    <p>{fb.reply}</p>
                  </div>
                )}

                {fb.status !== "resolved" && (
                  <div className="fb-admin-actions">
                    <textarea
                      className="form-input"
                      rows={2}
                      placeholder="Write a reply…"
                      value={replyForm[fb.id] || ""}
                      onChange={(e) => setReplyForm({ ...replyForm, [fb.id]: e.target.value })}
                    />
                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                      <button className="btn btn-primary btn-sm" onClick={() => sendReply(fb.id)} disabled={acting === fb.id}>
                        {acting === fb.id ? <span className="spinner" /> : <><i className="fas fa-reply" /> {t("reply")}</>}
                      </button>
                      <button className="btn btn-success btn-sm" onClick={() => resolve(fb.id)} disabled={acting === fb.id}>
                        <i className="fas fa-check" /> {t("resolve")}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
