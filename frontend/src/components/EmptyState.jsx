import "./EmptyState.css";

/* Inline SVG scenes — no external assets, theme-aware via CSS vars */
const SCENES = {
  conferences: (
    <svg viewBox="0 0 200 130" className="empty-svg">
      <rect x="35" y="30" width="130" height="90" rx="10" fill="var(--bg-input)" stroke="var(--border)" />
      <rect x="35" y="30" width="130" height="24" rx="10" fill="var(--accent-light)" />
      <circle cx="50" cy="42" r="4" fill="var(--accent)" opacity="0.7" />
      <circle cx="64" cy="42" r="4" fill="var(--accent)" opacity="0.45" />
      <rect x="50" y="66" width="46" height="8" rx="4" fill="var(--border)" />
      <rect x="50" y="82" width="76" height="6" rx="3" fill="var(--border)" opacity="0.6" />
      <rect x="50" y="94" width="60" height="6" rx="3" fill="var(--border)" opacity="0.4" />
      <circle cx="150" cy="95" r="17" fill="var(--accent)" />
      <path d="M150 88v14M143 95h14" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
      <circle cx="28" cy="24" r="4" fill="var(--accent)" opacity="0.3" />
      <circle cx="176" cy="46" r="3" fill="var(--accent)" opacity="0.35" />
      <circle cx="20" cy="90" r="2.5" fill="var(--accent)" opacity="0.25" />
    </svg>
  ),
  attendees: (
    <svg viewBox="0 0 200 130" className="empty-svg">
      <circle cx="76" cy="52" r="16" fill="var(--accent-light)" stroke="var(--accent)" strokeOpacity="0.4" />
      <path d="M48 100c2-16 13-25 28-25s26 9 28 25" fill="var(--accent-light)" stroke="var(--accent)" strokeOpacity="0.4" />
      <circle cx="124" cy="56" r="12" fill="var(--bg-input)" stroke="var(--border)" />
      <path d="M103 100c2-13 10-20 21-20s19 7 21 20" fill="var(--bg-input)" stroke="var(--border)" />
      <circle cx="158" cy="42" r="13" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeDasharray="4 4" opacity="0.6" />
      <path d="M158 36v12M152 42h12" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" opacity="0.8" />
      <circle cx="34" cy="34" r="3" fill="var(--accent)" opacity="0.3" />
      <circle cx="180" cy="86" r="2.5" fill="var(--accent)" opacity="0.28" />
    </svg>
  ),
  feedback: (
    <svg viewBox="0 0 200 130" className="empty-svg">
      <path d="M45 35h110a8 8 0 018 8v46a8 8 0 01-8 8H92l-18 18v-18H45a8 8 0 01-8-8V43a8 8 0 018-8z" fill="var(--bg-input)" stroke="var(--border)" />
      <rect x="56" y="54" width="70" height="7" rx="3.5" fill="var(--border)" />
      <rect x="56" y="70" width="90" height="6" rx="3" fill="var(--border)" opacity="0.55" />
      <circle cx="150" cy="30" r="12" fill="var(--accent)" opacity="0.9" />
      <path d="M145 30l4 4 7-8" stroke="#fff" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="30" cy="98" r="3" fill="var(--accent)" opacity="0.3" />
    </svg>
  ),
  search: (
    <svg viewBox="0 0 200 130" className="empty-svg">
      <circle cx="90" cy="58" r="30" fill="var(--bg-input)" stroke="var(--accent)" strokeWidth="3" strokeOpacity="0.5" />
      <line x1="113" y1="81" x2="136" y2="104" stroke="var(--accent)" strokeWidth="6" strokeLinecap="round" strokeOpacity="0.6" />
      <path d="M80 52c3-5 8-8 13-7" stroke="var(--accent)" strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.5" />
      <circle cx="152" cy="36" r="3.5" fill="var(--accent)" opacity="0.3" />
      <circle cx="42" cy="92" r="2.5" fill="var(--accent)" opacity="0.28" />
      <circle cx="50" cy="30" r="2" fill="var(--accent)" opacity="0.22" />
    </svg>
  ),
  lost: (
    <svg viewBox="0 0 200 130" className="empty-svg">
      <text x="100" y="82" textAnchor="middle" fontSize="58" fontWeight="800" fill="var(--accent-light)" stroke="var(--accent)" strokeOpacity="0.45">404</text>
      <circle cx="40" cy="36" r="4" fill="var(--accent)" opacity="0.3" />
      <circle cx="164" cy="44" r="3" fill="var(--accent)" opacity="0.35" />
      <circle cx="152" cy="104" r="2.5" fill="var(--accent)" opacity="0.25" />
      <path d="M30 106q10-8 20 0t20 0" stroke="var(--border)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </svg>
  ),
};

export default function EmptyState({ scene = "search", title, message, children }) {
  return (
    <div className="empty-scene">
      {SCENES[scene] || SCENES.search}
      {title && <h3 className="empty-scene-title">{title}</h3>}
      {message && <p className="empty-scene-msg">{message}</p>}
      {children && <div className="empty-scene-actions">{children}</div>}
    </div>
  );
}
