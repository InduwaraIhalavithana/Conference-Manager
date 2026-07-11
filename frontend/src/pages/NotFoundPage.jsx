import { Link } from "react-router-dom";
import EmptyState from "../components/EmptyState";

export default function NotFoundPage() {
  return (
    <div className="page-wrapper">
      <div className="container" style={{ display: "flex", justifyContent: "center", paddingTop: 40 }}>
        <EmptyState
          scene="lost"
          title="Page not found"
          message="The page you're looking for doesn't exist or has been moved."
        >
          <Link to="/" className="btn btn-primary"><i className="fas fa-home" /> Back to Home</Link>
          <Link to="/conferences" className="btn btn-ghost"><i className="fas fa-calendar-alt" /> Browse Conferences</Link>
        </EmptyState>
      </div>
    </div>
  );
}
