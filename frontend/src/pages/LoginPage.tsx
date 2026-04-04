import { useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { HardDrive } from "lucide-react";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  if (isAuthenticated) {
    navigate("/", { replace: true });
    return null;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(username, password);
      navigate("/", { replace: true });
    } catch {
      setError("Invalid username or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50/50">
      <div className="bg-white border border-gray-200 p-8 rounded-2xl w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-gray-900 p-3 rounded-xl mb-4">
            <HardDrive className="text-white" size={22} />
          </div>
          <h1 className="text-lg font-semibold text-gray-900">
            Binary Manager
          </h1>
          <p className="text-[13px] text-gray-400 mt-1">
            Sign in to continue
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-shadow"
            autoFocus
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-shadow"
          />
          {error && (
            <p className="text-red-500 text-[13px]">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading || !username || !password}
            className="w-full mt-1 bg-gray-900 text-white py-2.5 px-4 rounded-xl text-sm font-medium hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
