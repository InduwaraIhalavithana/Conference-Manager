import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { api } from "../services/api";
import ConferenceModal from "../components/ConferenceModal";
import "./ManageConferencesPage.css";

export default function ManageConferencesPage() {
  const { t, token } = useApp();
  const [conferences, setConferences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const load = () => api.myConferences(token).then(setConferences).finally(() => setLoading(false));
  useEffect(() => { load(); }, [token]);

  const handleDelete = async (conf) => {
    if (!window.confirm(`Delete "${conf.title}"?`)) return;
    setDeleting(conf.id);
    try {
      await api.deleteConference(conf.id, token);
      setConferences((prev) => prev.filter((c) => c.id !== conf.id));
    } finally {
      setDeleting(null);
    }
  };

  const handleSaved = (saved) => {
    if (modal === "create") {
      setConferences((prev) => [saved, ...prev]);
    } else {
      setConferences((prev) => prev.map((c) => (c.id === saved.id ? saved : c)));
    }
    setModal(null);
  };

  return (
    <div className="page-wrapper">
      <div className="container">
        <div className="page-header">
          <h1><i className="fas fa-calendar-alt" /> {t("my_conferences")}</h1>
          <button className="btn btn-primary" onClick={() => setModal("create")}>
            <i className="fas fa-plus" /> {t("create_conference")}
          </button>
        </div>

        {loading ? (
          <div className="center-spinner"><span className="spinner" /></div>
        ) : conferences.length === 0 ? (
          <div className="empty-state">
            <i className="fas fa-calendar-plus" />
            <p>No conferences yet. Create your first one!</p>
            <button className="btn btn-primary" onClick={() => setModal("create")}>
              <i className="fas fa-plus" /> {t("create_conference")}
            </button>
          </div>
        ) : (
          <div className="manage-list">
            {conferences.map((c) => {
              const isPast = new Date(c.date) < new Date();
              return (
                <div key={c.id} className="manage-row card">
                  <div className={`manage-color-bar${isPast ? " past" : ""}`} />
                  <div className="manage-info">
                    <h3 className="manage-title">{c.title}</h3>
                    <div className="manage-meta">
                      <span><i className="fas fa-calendar" /> {new Date(c.date).toLocaleDateString()}</span>
                      {c.time && <span><i className="fas fa-clock" /> {c.time.slice(0, 5)}</span>}
                      <span><i className="fas fa-map-marker-alt" /> {c.location || "TBA"}</span>
                      <span className="tag"><i className="fas fa-users" /> {c.attendee_count}</span>
                      {isPast && <span className="badge badge-warning">Past</span>}
                    </div>
                  </div>
                  <div className="manage-actions">
                    <Link to={`/attendees/${c.id}`} className="btn btn-ghost btn-sm">
                      <i className="fas fa-users" /> Attendees
                    </Link>
                    <button className="btn btn-ghost btn-sm" onClick={() => setModal(c)}>
                      <i className="fas fa-edit" /> {t("edit_conference")}
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleDelete(c)}
                      disabled={deleting === c.id}
                    >
                      {deleting === c.id ? <span className="spinner" /> : <i className="fas fa-trash" />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {modal !== null && (
        <ConferenceModal
          conference={modal === "create" ? null : modal}
          token={token}
          onSaved={handleSaved}
          onClose={() => setModal(null)}
          t={t}
        />
      )}
    </div>
  );
}
