import { Outlet } from "react-router-dom";
import Topbar from "../components/Topbar";

export default function RootLayout() {
  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden">
      <Topbar />
      <div className="flex-1 overflow-auto bg-gray-50">
        <div className="w-full h-full p-6">
          <Outlet />
        </div>
      </div>
    </div>
  );
}