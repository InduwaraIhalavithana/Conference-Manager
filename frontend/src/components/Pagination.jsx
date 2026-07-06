export default function Pagination({ page, pages, onPage }) {
  if (pages <= 1) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center", marginTop: 24 }}>
      <button
        className="btn btn-ghost btn-sm"
        onClick={() => onPage(page - 1)}
        disabled={page <= 1}
      >
        <i className="fas fa-chevron-left" />
      </button>
      <span style={{ fontSize: "0.875rem", color: "var(--text-muted)" }}>
        Page {page} of {pages}
      </span>
      <button
        className="btn btn-ghost btn-sm"
        onClick={() => onPage(page + 1)}
        disabled={page >= pages}
      >
        <i className="fas fa-chevron-right" />
      </button>
    </div>
  );
}
