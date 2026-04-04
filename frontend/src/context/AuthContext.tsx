import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { login as apiLogin } from "../api/client";

interface AuthContextType {
  isAuthenticated: boolean;
  role: string;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [role, setRole] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("token");
    const savedRole = localStorage.getItem("role") || "user";
    if (token) {
      setIsAuthenticated(true);
      setRole(savedRole);
    }
  }, []);

  const login = async (username: string, password: string) => {
    const res = await apiLogin(username, password);
    localStorage.setItem("token", res.data.access_token);
    localStorage.setItem("role", res.data.role);
    setIsAuthenticated(true);
    setRole(res.data.role);
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    setIsAuthenticated(false);
    setRole("");
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, role, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
