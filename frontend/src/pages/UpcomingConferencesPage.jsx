import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { api } from "../services/api";
import Pagination from "../components/Pagination";
import { catMeta, countdownLabel, CATEGORY_META } from "../utils/categories";
import EmptyState from "../components/EmptyState";
import "./ConferencesPage.css";

const CATEGORIES = ["Tech", "Health", "Education", "Business", "Other"];

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

export default function UpcomingConferencesPage() {
  const { t } = useApp();
  const [conferences, setConferences] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(true);

  const load = (p = 1, cat = category) => {
    setLoading(true);
    api.upcomingConferences(p, cat || null)
      .then((res) => {
        setConferences(res.items);
        setPage(res.page);
        setPages(res.pages);
        setTotal(res.total);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(1, ""); }, []);

  const handleCategory = (cat) => {
    setCategory(cat);
    load(1, cat);
  };

  const filtered = conferences.filter((c) => {
    const matchesSearch =
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      (c.location || "").toLowerCase().includes(search.toLowerCase());
    const matchesFrom = !dateFrom || c.date >= dateFrom;
    const matchesTo = !dateTo || c.date <= dateTo;
    return matchesSearch && matchesFrom && matchesTo;
  });

  return (
    <div className="page-wrapper">
      <div className="container">

        {/* Banner header */}
        <div className="conf-page-banner">
          <div className="conf-page-banner-orb" />
          <div className="conf-page-banner-content">
            <div className="conf-page-banner-icon">
              <i className="fas fa-calendar-alt" />
            </div>
            <div>
              <h1>{t("upcoming_conferences")}</h1>
              <p>Find and register for upcoming events near you</p>
            </div>
          </div>
          <div className="conf-page-banner-count">
            {!loading && (
              <span className="tag">
                <i className="fas fa-list" /> {total} conference{total !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>

        {/* Category filter chips */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          <button
            className={`btn btn-sm ${category === "" ? "btn-primary" : "btn-ghost"}`}
            onClick={() => handleCategory("")}
          >
            All
          </button>
          {CATEGORIES.map((c) => {
            const m = CATEGORY_META[c];
            const active = category === c;
            return (
              <button
                key={c}
                className="btn btn-sm cat-chip"
                style={active
                  ? { background: m.color, color: "#fff", boxShadow: `0 4px 14px ${m.soft}` }
                  : { background: m.soft, color: m.color, border: `1px solid ${m.soft}` }}
                onClick={() => handleCategory(c)}
              >
                <i className={`fas fa-${m.icon}`} /> {c}
              </button>
            );
          })}
        </div>

        {/* Search + date range bar */}
        <div className="conf-search-bar" style={{ flexWrap: "wrap", gap: 12 }}>
          <div className="conf-search-input-wrap" style={{ flex: "1 1 220px" }}>
            <i className="fas fa-search" />
            <input
              className="form-input conf-search-input"
              type="search"
              placeholder="Search by title or location…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <label style={{ fontSize: "0.8rem", color: "var(--text-muted)", whiteSpace: "nowrap" }}>From</label>
            <input className="form-input" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={{ width: 140 }} />
            <label style={{ fontSize: "0.8rem", color: "var(--text-muted)", whiteSpace: "nowrap" }}>To</label>
            <input className="form-input" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={{ width: 140 }} />
            {(dateFrom || dateTo) && (
              <button className="btn btn-ghost btn-sm" onClick={() => { setDateFrom(""); setDateTo(""); }}>
                <i className="fas fa-times" />
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="center-spinner"><span className="spinner" /></div>
        ) : total === 0 ? (
          <div className="conf-empty-full">
            <div className="conf-empty-icon-wrap">
              <i className="fas fa-calendar-check" />
            </div>
            <h2>No upcoming conferences yet</h2>
            <p>Be the first to host an event. Register as an organizer, create your conference, and it will appear here for everyone to find and attend.</p>
            <div className="conf-empty-actions">
              <Link to="/register" className="btn btn-primary">
                <i className="fas fa-rocket" /> Become an Organizer
              </Link>
              <Link to="/" className="btn btn-ghost">
                <i className="fas fa-home" /> Back to Home
              </Link>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            scene="search"
            title="No conferences match"
            message={search ? `Nothing found for "${search}". Try different keywords or clear the filters.` : "No conferences match the selected filters."}
          >
            <button className="btn btn-ghost btn-sm" onClick={() => { setSearch(""); setDateFrom(""); setDateTo(""); }}>
              <i className="fas fa-times" /> Clear filters
            </button>
          </EmptyState>
        ) : (
          <>
            <div className="conf-grid">
              {filtered.map((c, idx) => {
                const m = catMeta(c.category);
                const d = new Date(c.date + "T00:00:00");
                const countdown = countdownLabel(c.date);
                const pct = c.max_attendees ? Math.min(100, Math.round((c.attendee_count / c.max_attendees) * 100)) : null;
                return (
                  <Link
                    to={`/conferences/${c.id}`}
                    key={c.id}
                    className="conf-card card fade-up-card"
                    style={{ "--cat": m.color, "--cat-soft": m.soft, "--stagger": idx % 8 }}
                  >
                    <div className="conf-card-accent" />
                    <div className="conf-card-top">
                      <div className="conf-cal-leaf">
                        <span className="conf-cal-month">{MONTHS[d.getMonth()]}</span>
                        <span className="conf-cal-day">{d.getDate()}</span>
                      </div>
                      <div className="conf-card-top-right">
                        {countdown && <span className="conf-countdown-chip">{countdown}</span>}
                        {c.category && (
                          <span className="conf-cat-tag"><i className={`fas fa-${m.icon}`} /> {c.category}</span>
                        )}
                      </div>
                    </div>
                    <h3 className="conf-title">{c.title}</h3>
                    {c.description && (
                      <p className="conf-desc">
                        {c.description.slice(0, 100)}{c.description.length > 100 ? "…" : ""}
                      </p>
                    )}
                    <p className="conf-location">
                      <i className="fas fa-map-marker-alt" /> {c.location || "TBA"}
                      {c.time && <>&nbsp;·&nbsp;<i className="fas fa-clock" /> {c.time.slice(0, 5)}</>}
                    </p>
                    <p className="conf-organizer"><i className="fas fa-user-tie" /> {c.organizer_name}</p>
                    {pct !== null && (
                      <div className="conf-cap">
                        <div className="conf-cap-bar"><div style={{ width: `${pct}%` }} /></div>
                        <span>{c.max_attendees - c.attendee_count} spots left</span>
                      </div>
                    )}
                    <div className="conf-footer">
                      <span className="tag">
                        <i className="fas fa-users" /> {c.attendee_count}
                        {c.max_attendees ? ` / ${c.max_attendees}` : ""} {t("attendees")}
                      </span>
                      <span className="btn btn-primary btn-sm">{t("register_attend")} →</span>
                    </div>
                  </Link>
                );
              })}
            </div>
            <Pagination page={page} pages={pages} onPage={(p) => load(p)} />
          </>
        )}
      </div>
    </div>
  );
}
