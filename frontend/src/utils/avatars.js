/* Deterministic avatar colors — same person always gets the same hue */
const AVATAR_COLORS = [
  "#00a8ff", "#10b981", "#a855f7", "#f59e0b", "#ef4444",
  "#06b6d4", "#8b5cf6", "#ec4899", "#84cc16", "#f97316",
];

export function avatarColor(seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export function initials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}
