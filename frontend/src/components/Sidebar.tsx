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
    <aside className="w-56 bg-white border-r border-gray-200 flex flex-col min-h-screen">
      <div className="px-5 py-5 border-b border-gray-100">
        <h1 className="text-base font-semibold text-gray-900 tracking-tight">
          Binary Manager
        </h1>
        <p className="text-[11px] text-gray-400 mt-0.5">Retention Manager</p>
      </div>
      <nav className="flex-1 px-3 py-3 space-y-0.5">
        {visibleLinks.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === "/"}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                isActive
                  ? "bg-gray-900 text-white"
                  : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
              }`
            }
          >
            <link.icon size={16} strokeWidth={1.8} />
            {link.label}
          </NavLink>
        ))}
      </nav>
      <div className="px-3 py-3 border-t border-gray-100">
        <button
          onClick={logout}
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium w-full text-gray-400 hover:text-gray-900 hover:bg-gray-50 transition-colors"
        >
          <LogOut size={16} strokeWidth={1.8} />
          Logout
        </button>
      </div>
    </aside>
  );
}
