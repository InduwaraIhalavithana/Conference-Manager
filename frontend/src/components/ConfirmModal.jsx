import { useEffect } from "react";
import "./ConfirmModal.css";

/**
 * Themed replacement for window.confirm().
 * Usage: {confirm && <ConfirmModal title="…" message="…" danger onConfirm={…} onCancel={…} />}
 */
export default function ConfirmModal({
  title = "Are you sure?",
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}) {
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onCancel(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onCancel]);

  return (
    <div className="cmodal-backdrop" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="cmodal-box" role="alertdialog" aria-modal="true">
        <div className={`cmodal-icon ${danger ? "cmodal-icon--danger" : ""}`}>
          <i className={`fas fa-${danger ? "exclamation-triangle" : "question-circle"}`} />
        </div>
        <h3 className="cmodal-title">{title}</h3>
        {message && <p className="cmodal-message">{message}</p>}
        <div className="cmodal-actions">
          <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`btn ${danger ? "btn-danger" : "btn-primary"}`}
            onClick={onConfirm}
            disabled={busy}
            autoFocus
          >
            {busy ? <span className="spinner" /> : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
