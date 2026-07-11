import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { useApp } from "../../context/AppContext";
import { api } from "../../services/api";
import AdminLayout from "./AdminLayout";
import EmptyState from "../../components/EmptyState";
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
    try {
      await api.replyFeedback(id, { reply }, token);
      setFeedback((prev) => prev.map((f) => f.id === id ? { ...f, reply } : f));
      toast.success("Reply sent.");
    } catch (err) { toast.error(err.message); }
    finally { setActing(null); }
  };

  const resolve = async (id) => {
    setActing(id);
    try {
      await api.resolveFeedback(id, token);
      setFeedback((prev) => prev.map((f) => f.id === id ? { ...f, status: "resolved" } : f));
      toast.success("Marked as resolved.");
    } catch (err) { toast.error(err.message); }
    finally { setActing(null); }
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
          <EmptyState scene="feedback" title="No feedback yet" message="When organizers submit feedback or questions, they'll show up here for you to reply." />
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
