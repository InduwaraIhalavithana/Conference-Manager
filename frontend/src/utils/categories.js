/* Category color + icon system — used on cards, chips, detail hero */
export const CATEGORY_META = {
  Tech:      { color: "#00a8ff", soft: "rgba(0,168,255,0.14)",  icon: "microchip"     },
  Health:    { color: "#10b981", soft: "rgba(16,185,129,0.14)", icon: "heartbeat"     },
  Education: { color: "#a855f7", soft: "rgba(168,85,247,0.14)", icon: "graduation-cap" },
  Business:  { color: "#f59e0b", soft: "rgba(245,158,11,0.14)", icon: "briefcase"     },
  Other:     { color: "#64748b", soft: "rgba(100,116,139,0.14)", icon: "shapes"       },
};

export const DEFAULT_CAT = { color: "var(--accent)", soft: "var(--accent-light)", icon: "calendar" };

export const catMeta = (category) => CATEGORY_META[category] || DEFAULT_CAT;

/* Days until a yyyy-mm-dd date (0 = today) */
export const daysUntil = (dateStr) =>
  Math.max(0, Math.ceil((new Date(dateStr + "T00:00:00") - new Date()) / 86400000));

export const countdownLabel = (dateStr) => {
  const d = daysUntil(dateStr);
  if (d === 0) return "Today";
  if (d === 1) return "Tomorrow";
  if (d <= 30) return `In ${d} days`;
  return null;
};
