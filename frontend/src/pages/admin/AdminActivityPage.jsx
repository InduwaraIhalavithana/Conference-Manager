import { useState, useEffect } from "react";
import { useApp } from "../../context/AppContext";
import { api } from "../../services/api";
import AdminLayout from "./AdminLayout";
import Pagination from "../../components/Pagination";
import "./AdminPages.css";

export default function AdminActivityPage() {
  const { t, token } = useApp();
  const [logs, setLogs] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = (p = 1) => {
    setLoading(true);
    api.activityLog(token, p)
      .then((res) => {
        setLogs(res.items);
        setPage(res.page);
        setPages(res.pages);
        setTotal(res.total);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(1); }, [token]);

  const actionColor = (action) => {
    if (action.includes("delete")) return "danger";
    if (action.includes("create")) return "success";
    if (action.includes("update") || action.includes("change")) return "info";
    return "warning";
  };

  return (
    <AdminLayout>
      <div className="container">
        <div className="admin-page-header">
          <h1><i className="fas fa-list-alt" /> {t("activity_log")}</h1>
          <span className="tag">{total} entries</span>
        </div>
        {loading ? (
          <div className="center-spinner"><span className="spinner" /></div>
        ) : logs.length === 0 ? (
          <div className="empty-state"><i className="fas fa-clipboard-list" /><p>No activity yet.</p></div>
        ) : (
          <>
            <div className="admin-table-wrap card">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Action</th>
                    <th>Target</th>
                    <th>{t("organizer")}</th>
                    <th>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((l) => (
                    <tr key={l.id}>
                      <td><span className={`badge badge-${actionColor(l.action)}`}>{l.action.replace(/_/g, " ")}</span></td>
                      <td>{l.target || "—"}</td>
                      <td>{l.organizer_name || "—"}</td>
                      <td className="td-date">{new Date(l.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pages={pages} onPage={load} />
          </>
        )}
      </div>
    </AdminLayout>
  );
}
