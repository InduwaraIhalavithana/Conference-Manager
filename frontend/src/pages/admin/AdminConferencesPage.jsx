import { useState, useEffect } from "react";
import { useApp } from "../../context/AppContext";
import { api } from "../../services/api";
import AdminLayout from "./AdminLayout";
import "./AdminPages.css";

export default function AdminConferencesPage() {
  const { t, token } = useApp();
  const [confs, setConfs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    api.adminConferences(token).then(setConfs).finally(() => setLoading(false));
  }, [token]);

  const filtered = confs.filter((c) =>
    c.title.toLowerCase().includes(search.toLowerCase()) ||
    (c.organizer_name || "").toLowerCase().includes(search.toLowerCase())
  );

  const today = new Date().toISOString().slice(0, 10);

  return (
    <AdminLayout>
      <div className="container">
        <div className="admin-page-header">
          <h1><i className="fas fa-calendar-alt" /> {t("conference_overview")}</h1>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div className="conf-search-input-wrap" style={{ maxWidth: 260 }}>
              <i className="fas fa-search" />
              <input className="form-input conf-search-input" type="search" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            {!loading && <span className="tag">{filtered.length} of {confs.length}</span>}
          </div>
        </div>
        {loading ? (
          <div className="center-spinner"><span className="spinner" /></div>
        ) : (
          <div className="admin-table-wrap card">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>{t("organizer")}</th>
                  <th>{t("date")}</th>
                  <th>Location</th>
                  <th>{t("attendees")}</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id}>
                    <td className="td-name">{c.title}</td>
                    <td>{c.organizer_name}</td>
                    <td className="td-date">{new Date(c.date).toLocaleDateString()}</td>
                    <td>{c.location || "—"}</td>
                    <td>{c.attendee_count}</td>
                    <td>
                      <span className={`badge badge-${c.date >= today ? "info" : "warning"}`}>
                        {c.date >= today ? t("upcoming_confs") : "Past"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
