import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { api } from "../services/api";
import { avatarColor, initials } from "../utils/avatars";
import ConfirmModal from "../components/ConfirmModal";
import EmptyState from "../components/EmptyState";
import "./ConferencesPage.css";
import "./AttendeesPage.css";
import "./admin/AdminPages.css";

/* Mini bar chart: registrations per day (last 14 days) */
function RegTimeline({ attendees }) {
  if (attendees.length === 0) return null;
  const days = [];
  const today = new Date();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  const counts = days.map((day) => attendees.filter((a) => a.registered_at.slice(0, 10) === day).length);
  const max = Math.max(...counts, 1);
  const recent = counts.reduce((s, c) => s + c, 0);
  if (recent === 0) return null;
  return (
    <div className="att-timeline card">
      <div className="att-timeline-head">
        <span className="att-timeline-title"><i className="fas fa-chart-bar" /> Registration timeline</span>
        <span className="att-timeline-sub">{recent} in the last 14 days</span>
      </div>
      <div className="att-timeline-bars">
        {counts.map((c, i) => (
          <div key={i} className="att-timeline-col" title={`${days[i]}: ${c}`}>
            <div
              className="att-timeline-bar"
              style={{ height: `${Math.max(4, (c / max) * 100)}%`, opacity: c === 0 ? 0.25 : 1, animationDelay: `${i * 40}ms` }}
            />
          </div>
        ))}
      </div>
      <div className="att-timeline-axis">
        <span>{days[0].slice(5)}</span>
        <span>{days[13].slice(5)}</span>
      </div>
    </div>
  );
}

export default function AttendeesPage() {
  const { confId } = useParams();
  const { t, token } = useApp();
  const [attendees, setAttendees] = useState([]);
  const [conf, setConf] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    Promise.all([
      api.getConference(confId),
      api.listAttendees(confId, token),
    ]).then(([c, a]) => { setConf(c); setAttendees(a); }).finally(() => setLoading(false));
  }, [confId, token]);

  const [confirmDel, setConfirmDel] = useState(null);

  const handleCancel = async () => {
    const attendee = confirmDel;
    setDeleting(attendee.id);
    try {
      await api.cancelAttendee(confId, attendee.id, token);
      setAttendees((prev) => prev.filter((a) => a.id !== attendee.id));
      setConfirmDel(null);
    } finally {
      setDeleting(null);
    }
  };

  const handleExport = () => {
    const url = api.exportAttendeesUrl(confId);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendees_${confId}.csv`;
    a.click();
  };

  const filtered = attendees.filter((a) =>
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.email.toLowerCase().includes(search.toLowerCase())
  );

  const pct = conf?.max_attendees ? Math.min(100, Math.round((attendees.length / conf.max_attendees) * 100)) : null;

  return (
    <div className="page-wrapper">
      <div className="container">
        <Link to="/my-conferences" className="back-link"><i className="fas fa-arrow-left" /> {t("back")}</Link>
        <div className="page-header">
          <div>
            <h1><i className="fas fa-users" /> {t("attendees")}</h1>
            {conf && <p style={{ color: "var(--text-muted)", marginTop: 4, fontSize: "0.875rem" }}>{conf.title}</p>}
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            {pct !== null && (
              <div className="att-cap-pill" title={`${pct}% of capacity`}>
                <div className="att-cap-pill-bar"><div style={{ width: `${pct}%` }} /></div>
                <span>{attendees.length}/{conf.max_attendees}</span>
              </div>
            )}
            <div className="conf-search-input-wrap" style={{ maxWidth: 280 }}>
              <i className="fas fa-search" />
              <input
                className="form-input conf-search-input"
                type="search"
                placeholder="Search attendees…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button className="btn btn-ghost btn-sm" onClick={handleExport} title="Export CSV">
              <i className="fas fa-download" /> Export CSV
            </button>
          </div>
        </div>

        {loading ? (
          <div className="center-spinner"><span className="spinner" /></div>
        ) : (
          <>
            <RegTimeline attendees={attendees} />
            {filtered.length === 0 ? (
              <EmptyState
                scene="attendees"
                title={search ? "No matching attendees" : "No attendees yet"}
                message={search
                  ? `Nobody matches "${search}". Try a different name or email.`
                  : "Once people register for this conference, they'll appear here."}
              >
                {search && (
                  <button className="btn btn-ghost btn-sm" onClick={() => setSearch("")}>
                    <i className="fas fa-times" /> Clear search
                  </button>
                )}
              </EmptyState>
            ) : (
              <div className="card">
                <div style={{ marginBottom: 12, fontSize: "0.875rem", color: "var(--text-muted)" }}>
                  {filtered.length} attendee{filtered.length !== 1 ? "s" : ""}
                </div>
                <table className="attendees-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Registered</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((a, i) => (
                      <tr key={a.id} className="att-row" style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}>
                        <td className="td-num">{i + 1}</td>
                        <td>
                          <span className="att-name-cell">
                            <span className="att-avatar" style={{ background: avatarColor(a.email) }}>
                              {initials(a.name)}
                            </span>
                            {a.name}
                          </span>
                        </td>
                        <td><a href={`mailto:${a.email}`} style={{ color: "var(--accent)" }}>{a.email}</a></td>
                        <td className="td-date">{new Date(a.registered_at).toLocaleDateString()}</td>
                        <td>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => setConfirmDel(a)}
                            disabled={deleting === a.id}
                            title="Remove attendee"
                          >
                            {deleting === a.id ? <span className="spinner" /> : <i className="fas fa-times" />}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {confirmDel && (
          <ConfirmModal
            danger
            title="Remove attendee?"
            message={`${confirmDel.name} (${confirmDel.email}) will be removed from this conference.`}
            confirmLabel="Remove"
            busy={deleting === confirmDel.id}
            onConfirm={handleCancel}
            onCancel={() => setConfirmDel(null)}
          />
        )}
      </div>
    </div>
  );
}
