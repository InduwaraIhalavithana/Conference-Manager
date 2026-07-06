import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { api } from "../services/api";
import "./HomePage.css";

export default function HomePage() {
  const { t, token, role } = useApp();
  const [upcoming, setUpcoming] = useState([]);

  useEffect(() => {
    api.upcomingConferences().then(setUpcoming).catch(() => {});
  }, []);

  return (
    <div className="home-page">
      {/* Hero */}
      <section className="hero-section">
        <div className="hero-orb hero-orb-1" />
        <div className="hero-orb hero-orb-2" />
        <div className="hero-orb hero-orb-3" />
        <div className="container hero-inner">
          <div className="hero-content fade-up">
            <div className="hero-badge">
              <i className="fas fa-star" /> ConferenceHub
            </div>
            <h1 className="hero-title">{t("hero_title")}</h1>
            <p className="hero-subtitle">{t("hero_subtitle")}</p>
            <div className="hero-actions">
              {token && role === "organizer" ? (
                <Link to="/dashboard" className="btn btn-primary">
                  <i className="fas fa-th-large" /> {t("dashboard")}
                </Link>
              ) : (
                <Link to="/register" className="btn btn-primary">
                  <i className="fas fa-rocket" /> {t("get_started")}
                </Link>
              )}
              <Link to="/conferences" className="btn btn-ghost">
                <i className="fas fa-calendar-alt" /> {t("browse_conferences")}
              </Link>
            </div>
            <div className="hero-trust">
              <span><i className="fas fa-shield-alt" /> Secure</span>
              <span><i className="fas fa-language" /> Multilingual</span>
              <span><i className="fas fa-moon" /> Dark Mode</span>
            </div>
          </div>

          {/* Mock conference card */}
          <div className="hero-visual fade-up" aria-hidden="true">
            <div className="mock-card">
              <div className="mock-card-top">
                <div className="mock-dot mock-dot-live" />
                <span className="mock-live-label">Live Event</span>
              </div>
              <div className="mock-card-title">Tech Summit 2026</div>
              <div className="mock-meta">
                <span><i className="fas fa-calendar" /> June 15, 2026</span>
                <span><i className="fas fa-clock" /> 09:00 AM</span>
              </div>
              <div className="mock-meta">
                <span><i className="fas fa-map-marker-alt" /> Colombo, Sri Lanka</span>
              </div>
              <div className="mock-divider" />
              <div className="mock-attendees-row">
                <div className="mock-avatars">
                  {["#00a8ff", "#10b981", "#f59e0b", "#ef4444"].map((c, i) => (
                    <span key={i} className="mock-avatar" style={{ background: c }} />
                  ))}
                </div>
                <span className="mock-att-count">128 attendees</span>
              </div>
              <div className="mock-reg-btn">
                <i className="fas fa-ticket-alt" /> Register Now
              </div>
            </div>
            <div className="hero-float-badge badge-top">
              <i className="fas fa-users" /> 42 joined today
            </div>
            <div className="hero-float-badge badge-bottom">
              <i className="fas fa-check-circle" /> Event live
            </div>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="stats-section">
        <div className="container stats-inner">
          {[
            { icon: "calendar-check", val: upcoming.length > 0 ? `${upcoming.length}+` : "—", label: t("stat_conferences") },
            { icon: "users",          val: "∞",    label: t("stat_attendees") },
            { icon: "language",       val: "3",    label: t("language") },
            { icon: "globe",          val: "24/7", label: "Always Online" },
          ].map((s) => (
            <div key={s.label} className="stat-pill">
              <div className="stat-pill-icon"><i className={`fas fa-${s.icon}`} /></div>
              <div>
                <div className="stat-pill-val">{s.val}</div>
                <div className="stat-pill-label">{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="features-section">
        <div className="container">
          <div className="section-header-centered">
            <div className="section-eyebrow">Why ConferenceHub</div>
            <h2 className="section-title">Everything you need to run great events</h2>
            <p className="section-subtitle">
              From creation to completion — manage every aspect of your conference in one place.
            </p>
          </div>
          <div className="features-grid">
            {[
              { icon: "calendar-plus", color: "blue",   title: "Easy Scheduling",    desc: "Create conferences with titles, dates, times, and locations in seconds. Update anytime." },
              { icon: "users",         color: "green",  title: "Attendee Tracking",  desc: "Attendees register with just a name and email. View your full list instantly." },
              { icon: "share-square",  color: "purple", title: "Public Discovery",   desc: "Your conference appears on the public listing — anyone can find and register." },
              { icon: "chart-bar",     color: "orange", title: "Live Statistics",    desc: "See attendee counts, upcoming events, and past conferences on your dashboard." },
              { icon: "comments",      color: "pink",   title: "Feedback System",    desc: "Submit feedback to admins who reply and resolve issues in real time." },
              { icon: "shield-alt",    color: "accent", title: "Secure & Reliable",  desc: "JWT-authenticated sessions, admin oversight, and account management built in." },
            ].map((f) => (
              <div key={f.title} className={`feature-card card feat-${f.color}`}>
                <div className="feature-icon"><i className={`fas fa-${f.icon}`} /></div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Upcoming conferences */}
      {upcoming.length > 0 && (
        <section className="upcoming-section">
          <div className="container">
            <div className="section-header-flex">
              <h2 className="section-title">{t("upcoming_conferences")}</h2>
              <Link to="/conferences" className="btn btn-ghost btn-sm">View all →</Link>
            </div>
            <div className="conf-grid">
              {upcoming.slice(0, 6).map((c) => (
                <Link to={`/conferences/${c.id}`} key={c.id} className="conf-card card">
                  <div className="conf-card-accent" />
                  <div className="conf-date-badge">
                    <i className="fas fa-calendar" />
                    {new Date(c.date).toLocaleDateString()}
                    {c.time && ` · ${c.time.slice(0, 5)}`}
                  </div>
                  <h3 className="conf-title">{c.title}</h3>
                  {c.description && (
                    <p className="conf-desc">
                      {c.description.slice(0, 80)}{c.description.length > 80 ? "…" : ""}
                    </p>
                  )}
                  <p className="conf-location">
                    <i className="fas fa-map-marker-alt" /> {c.location || "TBA"}
                  </p>
                  <p className="conf-organizer">
                    <i className="fas fa-user-tie" /> {c.organizer_name}
                  </p>
                  <div className="conf-footer">
                    <span className="tag"><i className="fas fa-users" /> {c.attendee_count}</span>
                    <span className="btn btn-primary btn-sm">{t("register_attend")} →</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* How it works */}
      <section className="how-section">
        <div className="container">
          <div className="section-header-centered">
            <div className="section-eyebrow">Simple by Design</div>
            <h2 className="section-title">How It Works</h2>
          </div>
          <div className="steps-grid">
            {[
              { icon: "user-plus",   title: "Register",  desc: "Create your organizer account in seconds. No credit card required." },
              { icon: "plus-circle", title: "Create",    desc: "Set up your conference with title, date, location, and description." },
              { icon: "share-alt",   title: "Publish",   desc: "Your conference goes live and appears on the public listings instantly." },
              { icon: "users",       title: "Manage",    desc: "Track attendees in real time and manage your event end-to-end." },
            ].map((step, i) => (
              <div className="step-card" key={i}>
                <div className="step-number">{i + 1}</div>
                <div className="step-icon"><i className={`fas fa-${step.icon}`} /></div>
                <h3>{step.title}</h3>
                <p>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="cta-section">
        <div className="container">
          <div className="cta-card">
            <div className="cta-orb" />
            <div className="cta-content">
              <div className="section-eyebrow" style={{ marginBottom: 12 }}>Get Started Today</div>
              <h2>Ready to host your first conference?</h2>
              <p>Join organizers who use ConferenceHub to run their events.</p>
              <div className="cta-actions">
                {token && role === "organizer" ? (
                  <Link to="/my-conferences" className="btn btn-primary">
                    <i className="fas fa-plus" /> Create Conference
                  </Link>
                ) : (
                  <Link to="/register" className="btn btn-primary">
                    <i className="fas fa-rocket" /> Get Started Free
                  </Link>
                )}
                <Link to="/conferences" className="btn btn-ghost">Browse Conferences →</Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
