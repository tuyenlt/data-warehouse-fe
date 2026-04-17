import { Link, useLocation } from "react-router-dom";
import "./topbar.css";

export default function Topbar() {
  const location = useLocation();

  const navItems = [
    { label: "Dashboard", path: "/dashboard" },
    { label: "Customer behavior", path: "/customer" },
    { label: "Sales", path: "/sale" },
    { label: "Inventory", path: "/inventory" },
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <aside className="sidebar-nav">
      <div className="sidebar-nav__brand">DW BI Console</div>
      <nav className="sidebar-nav__list">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`sidebar-nav__item ${isActive(item.path) ? "sidebar-nav__item--active" : ""}`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
