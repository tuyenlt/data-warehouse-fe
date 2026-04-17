import { Link } from "react-router-dom";
import "./not-found.css";

export default function NotFoundPage() {
  return (
    <section className="not-found-page">
      <div className="not-found-card">
        <h1>404</h1>
        <p>Page is unavailable in this demo.</p>
        <Link to="/dashboard" className="not-found-btn">
          Go To Dashboard
        </Link>
      </div>
    </section>
  );
}
