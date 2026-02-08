import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getDashboardStats, triggerCleanup, getCleanupStatus } from "../api/client";
import DiskUsageGauge from "../components/DiskUsageGauge";
import RetentionBadge from "../components/RetentionBadge";
import { FolderOpen, Package, Clock, Play, Loader2, X, AlertTriangle } from "lucide-react";

interface Stats {
  disk: {
    total_bytes: number;
    used_bytes: number;
    free_bytes: number;
    usage_percent: number;
  };
  total_projects: number;
  total_builds: number;
  cleanup_running: boolean;
  last_cleanup_at: string | null;
}

interface DryRunTarget {
  project: string;
  build_number: string;
  retention_type: string;
  age_days: number;
  score: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [cleanupRunning, setCleanupRunning] = useState(false);
  const [dryRunLoading, setDryRunLoading] = useState(false);
  const [dryRunTargets, setDryRunTargets] = useState<DryRunTarget[] | null>(null);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const fetchStats = async () => {
    try {
      const res = await getDashboardStats();
      setStats(res.data);
      setCleanupRunning(res.data.cleanup_running);
    } catch {
      setError("Failed to load dashboard stats");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!cleanupRunning) return;
    const interval = setInterval(async () => {
      const res = await getCleanupStatus();
      if (!res.data.running) {
        setCleanupRunning(false);
        fetchStats();
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [cleanupRunning]);

  const handleDryRun = async () => {
    setDryRunLoading(true);
    try {
      const res = await triggerCleanup(true);
      setDryRunTargets(res.data.targets);
    } catch {
      setError("Failed to trigger dry run");
    } finally {
      setDryRunLoading(false);
    }
  };

  const handleCleanup = async () => {
    try {
      await triggerCleanup(false);
      setCleanupRunning(true);
    } catch {
      setError("Failed to trigger cleanup");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-gray-400" size={32} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        {error}
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
        <div className="flex gap-2">
          <button
            onClick={handleDryRun}
            disabled={cleanupRunning || dryRunLoading}
            className="flex items-center gap-2 px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            {dryRunLoading ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Play size={14} />
            )}
            Dry Run
          </button>
          <button
            onClick={handleCleanup}
            disabled={cleanupRunning}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
          >
            {cleanupRunning ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Play size={14} />
            )}
            {cleanupRunning ? "Running..." : "Run Cleanup"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <DiskUsageGauge
          usagePercent={stats.disk.usage_percent}
          totalBytes={stats.disk.total_bytes}
          usedBytes={stats.disk.used_bytes}
          freeBytes={stats.disk.free_bytes}
        />

        <div
          onClick={() => navigate("/binaries")}
          className="bg-white rounded-lg shadow p-6 cursor-pointer hover:shadow-md transition-shadow"
        >
          <h3 className="text-sm font-medium text-gray-500 mb-2">Projects</h3>
          <div className="flex items-center gap-3">
            <FolderOpen className="text-blue-500" size={28} />
            <span className="text-3xl font-bold text-gray-900">
              {stats.total_projects}
            </span>
          </div>
        </div>

        <div
          onClick={() => navigate("/binaries")}
          className="bg-white rounded-lg shadow p-6 cursor-pointer hover:shadow-md transition-shadow"
        >
          <h3 className="text-sm font-medium text-gray-500 mb-2">
            Total Builds
          </h3>
          <div className="flex items-center gap-3">
            <Package className="text-green-500" size={28} />
            <span className="text-3xl font-bold text-gray-900">
              {stats.total_builds}
            </span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-2">
            Last Cleanup
          </h3>
          <div className="flex items-center gap-3">
            <Clock className="text-purple-500" size={28} />
            <span className="text-sm font-medium text-gray-900">
              {stats.last_cleanup_at
                ? new Date(stats.last_cleanup_at + "Z").toLocaleString("ko-KR", {
                    timeZone: "Asia/Seoul",
                  })
                : "Never"}
            </span>
          </div>
        </div>
      </div>

      {/* Dry Run Results Modal */}
      {dryRunTargets !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col mx-4">
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  Dry Run Results
                </h3>
                <p className="text-sm text-gray-500">
                  {dryRunTargets.length} builds would be deleted (score order)
                </p>
              </div>
              <button
                onClick={() => setDryRunTargets(null)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X size={20} />
              </button>
            </div>
            <div className="overflow-auto flex-1">
              {dryRunTargets.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  No builds to delete
                </div>
              ) : (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        #
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Project
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Build
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Type
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Age
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Score
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {dryRunTargets.map((t, i) => (
                      <tr key={`${t.project}-${t.build_number}`} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-sm text-gray-400">
                          {i + 1}
                        </td>
                        <td className="px-4 py-2 text-sm font-medium text-gray-900">
                          {t.project}
                        </td>
                        <td className="px-4 py-2 text-sm font-mono text-gray-900">
                          {t.build_number}
                        </td>
                        <td className="px-4 py-2 text-sm">
                          <RetentionBadge type={t.retention_type} />
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-600">
                          {t.age_days}d
                        </td>
                        <td className="px-4 py-2 text-sm font-mono text-gray-500">
                          {t.score}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="p-4 border-t flex justify-end">
              <button
                onClick={() => setDryRunTargets(null)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
