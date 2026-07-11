import { useState, useEffect } from "react";
import { useApp } from "../../context/AppContext";
import { api } from "../../services/api";
import AdminLayout from "./AdminLayout";
import Pagination from "../../components/Pagination";
import EmptyState from "../../components/EmptyState";
import { actionMeta } from "../../utils/activity";
import "./AdminPages.css";
import "./AdminCharts.css";

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
          <EmptyState scene="feedback" title="No activity yet" message="Organizer actions like logins, conference edits, and profile changes will show up here." />
        ) : (
          <>
            <div className="card">
              <div className="admin-activity-list">
                {logs.map((l, i) => {
                  const meta = actionMeta(l.action);
                  return (
                    <div key={l.id} className="admin-activity-row" style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}>
                      <span className={`admin-act-icon act-${meta.color}`}><i className={`fas fa-${meta.icon}`} /></span>
                      <span className="admin-act-text">
                        {l.action.replace(/_/g, " ")}
                        {l.target && <span className="admin-act-who"> · {l.target}</span>}
                        {l.organizer_name && <span className="admin-act-who"> · {l.organizer_name}</span>}
                      </span>
                      <span className="admin-act-time">{new Date(l.created_at).toLocaleString()}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <Pagination page={page} pages={pages} onPage={load} />
          </>
        )}
      </div>
    </AdminLayout>
  );
}
