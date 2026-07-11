import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { api } from "../services/api";
import ConferenceModal from "../components/ConferenceModal";
import ConfirmModal from "../components/ConfirmModal";
import EmptyState from "../components/EmptyState";
import Pagination from "../components/Pagination";
import { catMeta, countdownLabel } from "../utils/categories";
import "./ManageConferencesPage.css";

export default function ManageConferencesPage() {
  const { t, token } = useApp();
  const [conferences, setConferences] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const load = (p = 1) => {
    setLoading(true);
    api.myConferences(token, p)
      .then((res) => {
        setConferences(res.items);
        setPage(res.page);
        setPages(res.pages);
        setTotal(res.total);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(1); }, [token]);

  const [confirmDel, setConfirmDel] = useState(null);

  const handleDelete = async () => {
    const conf = confirmDel;
    setDeleting(conf.id);
    try {
      await api.deleteConference(conf.id, token);
      setConfirmDel(null);
      load(page);
    } finally {
      setDeleting(null);
    }
  };

  const handleSaved = (saved) => {
    if (modal === "create") {
      load(1);
    } else {
      setConferences((prev) => prev.map((c) => (c.id === saved.id ? saved : c)));
    }
    setModal(null);
  };

  return (
    <div className="page-wrapper">
      <div className="container">
        <div className="page-header">
          <div>
            <h1><i className="fas fa-calendar-alt" /> {t("my_conferences")}</h1>
            {!loading && <span className="tag" style={{ marginTop: 4 }}>{total} total</span>}
          </div>
          <button className="btn btn-primary" onClick={() => setModal("create")}>
            <i className="fas fa-plus" /> {t("create_conference")}
          </button>
        </div>

        {loading ? (
          <div className="center-spinner"><span className="spinner" /></div>
        ) : conferences.length === 0 ? (
          <EmptyState
            scene="conferences"
            title="No conferences yet"
            message="Create your first conference and start accepting registrations in minutes."
          >
            <button className="btn btn-primary" onClick={() => setModal("create")}>
              <i className="fas fa-plus" /> {t("create_conference")}
            </button>
          </EmptyState>
        ) : (
          <>
            <div className="manage-list">
              {conferences.map((c) => {
                const isPast = c.date < new Date().toISOString().slice(0, 10);
                const isDraft = c.status === "draft";
                const m = catMeta(c.category);
                const countdown = !isPast && countdownLabel(c.date);
                const pct = c.max_attendees ? Math.min(100, Math.round((c.attendee_count / c.max_attendees) * 100)) : null;
                return (
                  <div key={c.id} className="manage-row card" style={{ "--cat": m.color, "--cat-soft": m.soft }}>
                    <div className={`manage-color-bar${isPast ? " past" : ""}`} />
                    <div className="manage-info">
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <h3 className="manage-title">{c.title}</h3>
                        {isDraft && <span className="badge badge-warning">Draft</span>}
                        {isPast && <span className="badge badge-warning">Past</span>}
                        {c.category && (
                          <span className="conf-cat-tag" style={{ background: m.soft, color: m.color }}>
                            <i className={`fas fa-${m.icon}`} /> {c.category}
                          </span>
                        )}
                        {countdown && <span className="conf-countdown-chip">{countdown}</span>}
                      </div>
                      <div className="manage-meta">
                        <span><i className="fas fa-calendar" /> {new Date(c.date).toLocaleDateString()}</span>
                        {c.time && <span><i className="fas fa-clock" /> {c.time.slice(0, 5)}</span>}
                        <span><i className="fas fa-map-marker-alt" /> {c.location || "TBA"}</span>
                        <span className="tag">
                          <i className="fas fa-users" /> {c.attendee_count}
                          {c.max_attendees ? ` / ${c.max_attendees}` : ""}
                        </span>
                        {pct !== null && (
                          <span className="manage-cap-bar" title={`${pct}% full`}>
                            <span style={{ width: `${pct}%`, background: m.color }} />
                          </span>
                        )}
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
                        onClick={() => setConfirmDel(c)}
                        disabled={deleting === c.id}
                      >
                        {deleting === c.id ? <span className="spinner" /> : <i className="fas fa-trash" />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <Pagination page={page} pages={pages} onPage={load} />
          </>
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

      {confirmDel && (
        <ConfirmModal
          danger
          title="Delete conference?"
          message={`"${confirmDel.title}" and all its attendee registrations will be permanently removed.`}
          confirmLabel="Delete"
          busy={deleting === confirmDel.id}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDel(null)}
        />
      )}
    </div>
  );
}
