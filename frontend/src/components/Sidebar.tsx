import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  HardDrive,
  Settings,
  ScrollText,
  LogOut,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

const links = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard", adminOnly: false },
  { to: "/binaries", icon: HardDrive, label: "Binaries", adminOnly: false },
  { to: "/settings", icon: Settings, label: "Settings", adminOnly: true },
  { to: "/logs", icon: ScrollText, label: "Logs", adminOnly: false },
];

export default function Sidebar() {
  const { logout, role } = useAuth();

  const visibleLinks = links.filter(
    (link) => !link.adminOnly || role === "admin"
  );

  return (
    <aside className="w-56 bg-white border-r border-gray-100 flex flex-col min-h-screen">
      <div className="px-5 py-5 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 p-1.5 rounded-lg shadow-sm shadow-indigo-200">
            <HardDrive className="text-white" size={14} />
          </div>
          <div>
            <h1 className="text-[13px] font-bold text-gray-900 tracking-tight">
              Binary Manager
            </h1>
            <p className="text-[10px] text-gray-400 -mt-0.5">
              Retention Manager
            </p>
          </div>
        </div>
      </div>
      <nav className="flex-1 px-3 py-3 space-y-0.5">
        {visibleLinks.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === "/"}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all ${
                isActive
                  ? "bg-gradient-to-r from-indigo-50 to-indigo-100/50 text-indigo-700 shadow-sm"
                  : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <link.icon
                  size={16}
                  strokeWidth={1.8}
                  className={isActive ? "text-indigo-500" : ""}
                />
                {link.label}
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="px-3 py-3 border-t border-gray-100">
        <div className="flex items-center gap-2 px-3 py-1.5 mb-2">
          <div className="w-6 h-6 bg-gradient-to-br from-gray-200 to-gray-300 rounded-full flex items-center justify-center text-[10px] font-bold text-gray-600">
            {role === "admin" ? "A" : "U"}
          </div>
          <span className="text-[11px] text-gray-400 font-medium">
            {role === "admin" ? "Admin" : "User"}
          </span>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium w-full text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all"
        >
          <LogOut size={16} strokeWidth={1.8} />
          Logout
        </button>
      </div>
    </aside>
  );
}
