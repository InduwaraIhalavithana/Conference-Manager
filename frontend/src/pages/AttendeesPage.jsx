import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { api } from "../services/api";
import "./ConferencesPage.css";
import "./admin/AdminPages.css";

export default function AttendeesPage() {
  const { confId } = useParams();
  const { t, token } = useApp();
  const [attendees, setAttendees] = useState([]);
  const [conf, setConf] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    Promise.all([
      api.getConference(confId),
      api.listAttendees(confId, token),
    ]).then(([c, a]) => { setConf(c); setAttendees(a); }).finally(() => setLoading(false));
  }, [confId, token]);

  const filtered = attendees.filter((a) =>
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="page-wrapper">
      <div className="container">
        <Link to="/my-conferences" className="back-link"><i className="fas fa-arrow-left" /> {t("back")}</Link>
        <div className="page-header">
          <div>
            <h1><i className="fas fa-users" /> {t("attendees")}</h1>
            {conf && <p style={{ color: "var(--text-muted)", marginTop: 4, fontSize: "0.875rem" }}>{conf.title}</p>}
          </div>
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
        </div>

        {loading ? (
          <div className="center-spinner"><span className="spinner" /></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <i className="fas fa-user-slash" />
            <p>No attendees found.</p>
          </div>
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
                </tr>
              </thead>
              <tbody>
                {filtered.map((a, i) => (
                  <tr key={a.id}>
                    <td className="td-num">{i + 1}</td>
                    <td>{a.name}</td>
                    <td><a href={`mailto:${a.email}`} style={{ color: "var(--accent)" }}>{a.email}</a></td>
                    <td className="td-date">{new Date(a.registered_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
