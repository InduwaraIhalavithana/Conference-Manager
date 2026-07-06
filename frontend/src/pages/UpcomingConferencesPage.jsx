import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { api } from "../services/api";
import "./ConferencesPage.css";

export default function UpcomingConferencesPage() {
  const { t } = useApp();
  const [conferences, setConferences] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.upcomingConferences()
      .then(setConferences)
      .finally(() => setLoading(false));
  }, []);

  const filtered = conferences.filter((c) =>
    c.title.toLowerCase().includes(search.toLowerCase()) ||
    (c.location || "").toLowerCase().includes(search.toLowerCase())
  );

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
                <i className="fas fa-list" /> {conferences.length} conference{conferences.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>

        {/* Search bar */}
        <div className="conf-search-bar">
          <div className="conf-search-input-wrap">
            <i className="fas fa-search" />
            <input
              className="form-input conf-search-input"
              type="search"
              placeholder="Search by title or location…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {search && (
            <span className="text-muted" style={{ fontSize: "0.8rem" }}>
              {filtered.length} result{filtered.length !== 1 ? "s" : ""} for "{search}"
            </span>
          )}
        </div>

        {loading ? (
          <div className="center-spinner"><span className="spinner" /></div>
        ) : conferences.length === 0 ? (
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
            <div className="conf-placeholder-grid">
              {[
                { wide: "65%", lines: ["full","wide","medium"] },
                { wide: "75%", lines: ["full","wide","short"] },
                { wide: "55%", lines: ["full","medium","wide"] },
              ].map((card, i) => (
                <div key={i} className="conf-placeholder-card">
                  <div className="conf-placeholder-accent" />
                  <div className="conf-placeholder-bar short" />
                  <div className="conf-placeholder-bar tall" />
                  {card.lines.map((w, j) => (
                    <div key={j} className={`conf-placeholder-bar ${w}`} />
                  ))}
                  <div className="conf-placeholder-footer">
                    <div className="conf-placeholder-bar short" />
                    <div className="conf-placeholder-bar medium" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <i className="fas fa-calendar-times" />
            <p>No conferences match &ldquo;{search}&rdquo;</p>
            <button className="btn btn-ghost btn-sm" onClick={() => setSearch("")}>
              <i className="fas fa-times" /> Clear search
            </button>
          </div>
        ) : (
          <div className="conf-grid">
            {filtered.map((c) => (
              <Link to={`/conferences/${c.id}`} key={c.id} className="conf-card card">
                <div className="conf-card-accent" />
                <div className="conf-date-badge">
                  <i className="fas fa-calendar" />
                  {new Date(c.date).toLocaleDateString()} {c.time && `· ${c.time.slice(0, 5)}`}
                </div>
                <h3 className="conf-title">{c.title}</h3>
                {c.description && (
                  <p className="conf-desc">
                    {c.description.slice(0, 100)}{c.description.length > 100 ? "…" : ""}
                  </p>
                )}
                <p className="conf-location"><i className="fas fa-map-marker-alt" /> {c.location || "TBA"}</p>
                <p className="conf-organizer"><i className="fas fa-user-tie" /> {c.organizer_name}</p>
                <div className="conf-footer">
                  <span className="tag"><i className="fas fa-users" /> {c.attendee_count} {t("attendees")}</span>
                  <span className="btn btn-primary btn-sm">{t("register_attend")} →</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
