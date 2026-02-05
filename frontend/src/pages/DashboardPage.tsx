import { useState, useEffect } from "react";
import { getDashboardStats, triggerCleanup, getCleanupStatus } from "../api/client";
import DiskUsageGauge from "../components/DiskUsageGauge";
import { FolderOpen, Package, Clock, Play, Loader2 } from "lucide-react";

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

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [cleanupRunning, setCleanupRunning] = useState(false);
  const [error, setError] = useState("");

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

  const handleCleanup = async (dryRun: boolean) => {
    try {
      await triggerCleanup(dryRun);
      if (!dryRun) {
        setCleanupRunning(true);
      } else {
        fetchStats();
      }
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
            onClick={() => handleCleanup(true)}
            disabled={cleanupRunning}
            className="flex items-center gap-2 px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            <Play size={14} />
            Dry Run
          </button>
          <button
            onClick={() => handleCleanup(false)}
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

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Projects</h3>
          <div className="flex items-center gap-3">
            <FolderOpen className="text-blue-500" size={28} />
            <span className="text-3xl font-bold text-gray-900">
              {stats.total_projects}
            </span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
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
                ? new Date(stats.last_cleanup_at).toLocaleString()
                : "Never"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
