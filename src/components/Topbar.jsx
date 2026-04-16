import { Link, useLocation } from "react-router-dom";

export default function Topbar() {
  const location = useLocation();

  const navItems = [
    { label: "Dashboard", path: "/dashboard" },
    { label: "Khách Hàng", path: "/customer" },
    { label: "Bán Hàng", path: "/sale" },
    { label: "Tồn Kho", path: "/inventory" },
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="bg-white shadow-lg border-b border-gray-200 h-16 shrink-0">
      <div className="h-full px-6 flex justify-between items-center">
        <div className="text-2xl font-bold text-blue-600">DATA WAREHOUSE NHÓM 1</div>
        
        <div className="flex gap-8">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`font-medium transition-colors pb-4 border-b-2 ${
                isActive(item.path)
                  ? "text-blue-600 border-blue-600"
                  : "text-gray-700 hover:text-blue-600 border-transparent hover:border-blue-300"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
