import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../../context/AppContext";
import { api } from "../../services/api";
import AdminLayout from "./AdminLayout";
import Pagination from "../../components/Pagination";
import ConfirmModal from "../../components/ConfirmModal";
import "./AdminPages.css";

export default function AdminConferencesPage() {
  const { t, token } = useApp();
  const [confs, setConfs] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deleting, setDeleting] = useState(null);

  const load = (p = 1) => {
    setLoading(true);
    api.adminConferences(token, p)
      .then((res) => {
        setConfs(res.items);
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
      await api.adminDeleteConference(conf.id, token);
      setConfirmDel(null);
      load(page);
    } finally {
      setDeleting(null);
    }
  };

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
            {!loading && <span className="tag">{total} total</span>}
          </div>
        </div>
        {loading ? (
          <div className="center-spinner"><span className="spinner" /></div>
        ) : (
          <>
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
                    <th>{t("actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <tr key={c.id}>
                      <td className="td-name">
                        <Link to={`/conferences/${c.id}`} style={{ color: "var(--accent)" }} target="_blank" rel="noopener">
                          {c.title}
                        </Link>
                        {c.status === "draft" && <span className="badge badge-warning" style={{ marginLeft: 6 }}>Draft</span>}
                        {c.category && <span className="tag" style={{ marginLeft: 4, fontSize: "0.7rem" }}>{c.category}</span>}
                      </td>
                      <td>{c.organizer_name}</td>
                      <td className="td-date">{new Date(c.date).toLocaleDateString()}</td>
                      <td>{c.location || "—"}</td>
                      <td>{c.attendee_count}{c.max_attendees ? ` / ${c.max_attendees}` : ""}</td>
                      <td>
                        <span className={`badge badge-${c.date >= today ? "info" : "warning"}`}>
                          {c.date >= today ? t("upcoming_confs") : "Past"}
                        </span>
                      </td>
                      <td>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => setConfirmDel(c)}
                          disabled={deleting === c.id}
                        >
                          {deleting === c.id ? <span className="spinner" /> : <i className="fas fa-trash" />}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pages={pages} onPage={load} />
          </>
        )}

        {confirmDel && (
          <ConfirmModal
            danger
            title="Delete conference?"
            message={`"${confirmDel.title}" and all its registrations will be permanently removed. This cannot be undone.`}
            confirmLabel="Delete"
            busy={deleting === confirmDel.id}
            onConfirm={handleDelete}
            onCancel={() => setConfirmDel(null)}
          />
        )}
      </div>
    </AdminLayout>
  );
}
