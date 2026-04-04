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
  retention_days?: number;
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
        <Loader2 className="animate-spin text-gray-300" size={24} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-[13px] text-red-600">
        {error}
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-xl font-semibold text-gray-900">Dashboard</h2>
        <div className="flex gap-2">
          <button
            onClick={handleDryRun}
            disabled={cleanupRunning || dryRunLoading}
            className="flex items-center gap-1.5 px-3.5 py-2 text-[13px] font-medium border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition-colors"
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
            className="flex items-center gap-1.5 px-3.5 py-2 text-[13px] font-medium bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-40 transition-colors"
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
          className="bg-white border border-gray-200 rounded-xl p-5 cursor-pointer hover:border-gray-300 transition-colors"
        >
          <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-3">
            Projects
          </p>
          <div className="flex items-center gap-3">
            <FolderOpen className="text-blue-500" size={22} strokeWidth={1.8} />
            <span className="text-3xl font-semibold text-gray-900 tabular-nums">
              {stats.total_projects}
            </span>
          </div>
        </div>

        <div
          onClick={() => navigate("/binaries")}
          className="bg-white border border-gray-200 rounded-xl p-5 cursor-pointer hover:border-gray-300 transition-colors"
        >
          <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-3">
            Total Builds
          </p>
          <div className="flex items-center gap-3">
            <Package className="text-emerald-500" size={22} strokeWidth={1.8} />
            <span className="text-3xl font-semibold text-gray-900 tabular-nums">
              {stats.total_builds}
            </span>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-3">
            Last Cleanup
          </p>
          <div className="flex items-center gap-3">
            <Clock className="text-violet-500" size={22} strokeWidth={1.8} />
            <span className="text-[13px] font-medium text-gray-900">
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
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col mx-4">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h3 className="text-base font-semibold text-gray-900">
                  Dry Run Results
                </h3>
                <p className="text-[12px] text-gray-400 mt-0.5">
                  {dryRunTargets.length} builds would be deleted
                </p>
              </div>
              <button
                onClick={() => setDryRunTargets(null)}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="overflow-auto flex-1">
              {dryRunTargets.length === 0 ? (
                <div className="p-8 text-center text-[13px] text-gray-400">
                  No builds to delete
                </div>
              ) : (
                <table className="min-w-full">
                  <thead className="bg-gray-50/80 sticky top-0">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider">
                        #
                      </th>
                      <th className="px-4 py-2.5 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider">
                        Project
                      </th>
                      <th className="px-4 py-2.5 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider">
                        Build
                      </th>
                      <th className="px-4 py-2.5 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-4 py-2.5 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider">
                        Age
                      </th>
                      <th className="px-4 py-2.5 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider">
                        Remaining
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {dryRunTargets.map((t, i) => (
                      <tr
                        key={`${t.project}-${t.build_number}`}
                        className="border-b border-gray-50 hover:bg-gray-50/50"
                      >
                        <td className="px-4 py-2 text-[12px] text-gray-300 tabular-nums">
                          {i + 1}
                        </td>
                        <td className="px-4 py-2 text-[13px] font-medium text-gray-900">
                          {t.project}
                        </td>
                        <td className="px-4 py-2 text-[13px] font-mono text-gray-700">
                          {t.build_number}
                        </td>
                        <td className="px-4 py-2">
                          <RetentionBadge
                            isCustom={t.retention_type === "custom"}
                            retentionDays={t.retention_days ?? 7}
                          />
                        </td>
                        <td className="px-4 py-2 text-[13px] text-gray-500 tabular-nums">
                          {t.age_days}d
                        </td>
                        <td className="px-4 py-2 text-[13px] font-mono text-gray-400 tabular-nums">
                          {t.score.toFixed(1)}d
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="px-5 py-3 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setDryRunTargets(null)}
                className="px-4 py-2 text-[13px] font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
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
