import { useState, useEffect } from "react";
import { useApp } from "../../context/AppContext";
import { api } from "../../services/api";
import AdminLayout from "./AdminLayout";
import Pagination from "../../components/Pagination";
import "./AdminPages.css";

export default function AdminOrganizersPage() {
  const { t, token } = useApp();
  const [orgs, setOrgs] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(null);

  const load = (p = 1) => {
    setLoading(true);
    api.adminOrganizers(token, p)
      .then((res) => {
        setOrgs(res.items);
        setPage(res.page);
        setPages(res.pages);
        setTotal(res.total);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(1); }, [token]);

  const suspend = async (id) => {
    setActing(id);
    await api.suspendOrganizer(id, token);
    setOrgs((prev) => prev.map((o) => o.id === id ? { ...o, is_suspended: true } : o));
    setActing(null);
  };

  const unsuspend = async (id) => {
    setActing(id);
    await api.unsuspendOrganizer(id, token);
    setOrgs((prev) => prev.map((o) => o.id === id ? { ...o, is_suspended: false } : o));
    setActing(null);
  };

  const del = async (id, name) => {
    if (!window.confirm(`Delete ${name}?`)) return;
    setActing(id);
    await api.deleteOrganizer(id, token);
    load(page);
    setActing(null);
  };

  return (
    <AdminLayout>
      <div className="container">
        <div className="admin-page-header">
          <h1><i className="fas fa-users" /> {t("organizer_management")}</h1>
          <span className="tag">{total} total</span>
        </div>
        {loading ? (
          <div className="center-spinner"><span className="spinner" /></div>
        ) : (
          <>
            <div className="admin-table-wrap card">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Status</th>
                    <th>Joined</th>
                    <th>{t("actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {orgs.map((o) => (
                    <tr key={o.id}>
                      <td className="td-name">{o.first_name} {o.last_name}</td>
                      <td className="td-email">{o.email}</td>
                      <td>{o.phone || "—"}</td>
                      <td>
                        <span className={`badge badge-${o.is_suspended ? "danger" : "success"}`}>
                          {o.is_suspended ? t("suspended") : t("active_organizers")}
                        </span>
                      </td>
                      <td className="td-date">{new Date(o.created_at).toLocaleDateString()}</td>
                      <td>
                        <div className="td-actions">
                          {o.is_suspended ? (
                            <button className="btn btn-success btn-sm" onClick={() => unsuspend(o.id)} disabled={acting === o.id}>
                              {acting === o.id ? <span className="spinner" /> : <><i className="fas fa-check" /> {t("unsuspend")}</>}
                            </button>
                          ) : (
                            <button className="btn btn-ghost btn-sm" onClick={() => suspend(o.id)} disabled={acting === o.id}>
                              {acting === o.id ? <span className="spinner" /> : <><i className="fas fa-ban" /> {t("suspend")}</>}
                            </button>
                          )}
                          <button className="btn btn-danger btn-sm" onClick={() => del(o.id, `${o.first_name} ${o.last_name}`)} disabled={acting === o.id}>
                            <i className="fas fa-trash" />
                          </button>
                        </div>
                      </td>
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
