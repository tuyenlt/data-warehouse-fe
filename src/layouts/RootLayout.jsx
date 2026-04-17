import { Outlet } from "react-router-dom";
import Topbar from "../components/Topbar";

export default function RootLayout() {
  return (
    <div className="min-h-screen w-screen flex overflow-hidden bg-slate-50">
      <Topbar />
      <div className="flex-1 overflow-auto">
        <div className="w-full min-h-screen p-5 md:p-6">
          <Outlet />
        </div>
      </div>
    </div>
  );
}