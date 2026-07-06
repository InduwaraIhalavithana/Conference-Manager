export function SkeletonCard() {
  return (
    <div className="card" style={{ padding: 20, animation: "pulse 1.4s ease-in-out infinite" }}>
      <div style={{ height: 14, borderRadius: 6, background: "var(--bg-hover)", width: "60%", marginBottom: 12 }} />
      <div style={{ height: 10, borderRadius: 6, background: "var(--bg-hover)", width: "90%", marginBottom: 8 }} />
      <div style={{ height: 10, borderRadius: 6, background: "var(--bg-hover)", width: "75%", marginBottom: 8 }} />
      <div style={{ height: 10, borderRadius: 6, background: "var(--bg-hover)", width: "50%" }} />
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div style={{ display: "flex", gap: 16, padding: "12px 0", borderBottom: "1px solid var(--border)", animation: "pulse 1.4s ease-in-out infinite" }}>
      <div style={{ height: 12, borderRadius: 4, background: "var(--bg-hover)", width: "30%" }} />
      <div style={{ height: 12, borderRadius: 4, background: "var(--bg-hover)", width: "25%" }} />
      <div style={{ height: 12, borderRadius: 4, background: "var(--bg-hover)", width: "20%" }} />
      <div style={{ height: 12, borderRadius: 4, background: "var(--bg-hover)", flex: 1 }} />
    </div>
  );
}
