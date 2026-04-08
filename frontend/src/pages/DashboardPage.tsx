import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  getDashboardStats,
  triggerCleanup,
  getCleanupStatus,
  abortCleanup,
} from "../api/client";
import DiskUsageGauge from "../components/DiskUsageGauge";
import RetentionBadge from "../components/RetentionBadge";
import {
  FolderOpen,
  Package,
  Clock,
  Play,
  Loader2,
  X,
  Square,
} from "lucide-react";

interface ServerStat {
  name: string;
  disk: {
    total_bytes: number;
    used_bytes: number;
    free_bytes: number;
    usage_percent: number;
  };
  project_count: number;
  build_count: number;
}

interface Stats {
  servers: ServerStat[];
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

type PanelMode = "none" | "dryrun" | "cleanup";

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [cleanupRunning, setCleanupRunning] = useState(false);
  const [dryRunLoading, setDryRunLoading] = useState(false);
  const [dryRunTargets, setDryRunTargets] = useState<DryRunTarget[]>([]);
  const [cleanupLogs, setCleanupLogs] = useState<string[]>([]);
  const [panelMode, setPanelMode] = useState<PanelMode>("none");
  const [aborting, setAborting] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const logEndRef = useRef<HTMLDivElement>(null);

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

  // Poll cleanup status while running
  useEffect(() => {
    if (!cleanupRunning) return;
    const interval = setInterval(async () => {
      try {
        const res = await getCleanupStatus();
        setCleanupLogs(res.data.logs || []);
        if (!res.data.running) {
          setCleanupRunning(false);
          setAborting(false);
          fetchStats();
        }
      } catch {
        // ignore
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [cleanupRunning]);

  // Auto-scroll logs
  useEffect(() => {
    if (panelMode === "cleanup") {
      logEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [cleanupLogs, panelMode]);

  const handleDryRun = async () => {
    setDryRunLoading(true);
    setPanelMode("dryrun");
    setDryRunTargets([]);
    try {
      const res = await triggerCleanup(true);
      setDryRunTargets(res.data.targets);
    } catch {
      setError("Failed to trigger dry run");
      setPanelMode("none");
    } finally {
      setDryRunLoading(false);
    }
  };

  const handleCleanup = async () => {
    try {
      setCleanupLogs([]);
      setPanelMode("cleanup");
      await triggerCleanup(false);
      setCleanupRunning(true);
    } catch {
      setError("Failed to trigger cleanup");
    }
  };

  const handleAbort = async () => {
    setAborting(true);
    try {
      await abortCleanup();
    } catch {
      setAborting(false);
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

  const totalProjects = stats.servers.reduce(
    (s, sv) => s + sv.project_count,
    0
  );
  const totalBuilds = stats.servers.reduce((s, sv) => s + sv.build_count, 0);

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

      {/* Per-server stats */}
      <div className="space-y-4 mb-6">
        {stats.servers.map((srv) => (
          <div
            key={srv.name}
            className="grid grid-cols-1 md:grid-cols-3 gap-4"
          >
            <DiskUsageGauge
              serverName={srv.name}
              usagePercent={srv.disk.usage_percent}
              totalBytes={srv.disk.total_bytes}
              usedBytes={srv.disk.used_bytes}
              freeBytes={srv.disk.free_bytes}
            />
            <div
              onClick={() => navigate("/binaries")}
              className="bg-white border border-gray-200 rounded-xl p-5 cursor-pointer hover:border-gray-300 transition-colors"
            >
              <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-3">
                Projects
              </p>
              <div className="flex items-center gap-3">
                <FolderOpen
                  className="text-blue-500"
                  size={22}
                  strokeWidth={1.8}
                />
                <span className="text-3xl font-semibold text-gray-900 tabular-nums">
                  {srv.project_count}
                </span>
              </div>
            </div>
            <div
              onClick={() => navigate("/binaries")}
              className="bg-white border border-gray-200 rounded-xl p-5 cursor-pointer hover:border-gray-300 transition-colors"
            >
              <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-3">
                Builds
              </p>
              <div className="flex items-center gap-3">
                <Package
                  className="text-emerald-500"
                  size={22}
                  strokeWidth={1.8}
                />
                <span className="text-3xl font-semibold text-gray-900 tabular-nums">
                  {srv.build_count}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div
          onClick={() => navigate("/binaries")}
          className="bg-white border border-gray-200 rounded-xl p-5 cursor-pointer hover:border-gray-300 transition-colors"
        >
          <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-3">
            Total
          </p>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <FolderOpen
                className="text-blue-500"
                size={18}
                strokeWidth={1.8}
              />
              <span className="text-2xl font-semibold text-gray-900 tabular-nums">
                {totalProjects}
              </span>
              <span className="text-[12px] text-gray-400">projects</span>
            </div>
            <div className="flex items-center gap-2">
              <Package
                className="text-emerald-500"
                size={18}
                strokeWidth={1.8}
              />
              <span className="text-2xl font-semibold text-gray-900 tabular-nums">
                {totalBuilds}
              </span>
              <span className="text-[12px] text-gray-400">builds</span>
            </div>
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
                ? new Date(stats.last_cleanup_at + "Z").toLocaleString(
                    "ko-KR",
                    { timeZone: "Asia/Seoul" }
                  )
                : "Never"}
            </span>
          </div>
        </div>
      </div>

      {/* Result Panel — shared by Dry Run and Run Cleanup */}
      {panelMode !== "none" && (
        <div className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden mb-6">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
            <div className="flex items-center gap-2">
              {(cleanupRunning || dryRunLoading) && (
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              )}
              <span className="text-[13px] font-medium text-gray-200">
                {panelMode === "dryrun"
                  ? dryRunLoading
                    ? "Dry Run..."
                    : `Dry Run — ${dryRunTargets.length} builds would be deleted`
                  : cleanupRunning
                  ? "Cleanup Running"
                  : "Cleanup Finished"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {panelMode === "cleanup" && cleanupRunning && (
                <button
                  onClick={handleAbort}
                  disabled={aborting}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-40 transition-colors"
                >
                  {aborting ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Square size={12} />
                  )}
                  {aborting ? "Aborting..." : "Abort"}
                </button>
              )}
              {!(cleanupRunning || dryRunLoading) && (
                <button
                  onClick={() => setPanelMode("none")}
                  className="p-1 text-gray-400 hover:text-gray-200 rounded transition-colors"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>

          {/* Body */}
          <div className="max-h-80 overflow-auto">
            {panelMode === "dryrun" ? (
              dryRunLoading ? (
                <div className="p-6 text-center">
                  <Loader2
                    size={20}
                    className="animate-spin text-gray-500 mx-auto"
                  />
                </div>
              ) : dryRunTargets.length === 0 ? (
                <div className="p-6 text-center text-[13px] text-gray-500">
                  No builds to delete
                </div>
              ) : (
                <table className="min-w-full">
                  <thead className="bg-gray-800/50 sticky top-0">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider">
                        #
                      </th>
                      <th className="px-4 py-2.5 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider">
                        Project
                      </th>
                      <th className="px-4 py-2.5 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider">
                        Build
                      </th>
                      <th className="px-4 py-2.5 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-4 py-2.5 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider">
                        Age
                      </th>
                      <th className="px-4 py-2.5 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider">
                        Remaining
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {dryRunTargets.map((t, i) => (
                      <tr
                        key={`${t.project}-${t.build_number}`}
                        className="border-b border-gray-800 hover:bg-gray-800/30"
                      >
                        <td className="px-4 py-2 text-[12px] text-gray-600 tabular-nums">
                          {i + 1}
                        </td>
                        <td className="px-4 py-2 text-[13px] font-medium text-gray-200">
                          {t.project}
                        </td>
                        <td className="px-4 py-2 text-[13px] font-mono text-gray-400">
                          {t.build_number}
                        </td>
                        <td className="px-4 py-2">
                          <RetentionBadge
                            isCustom={t.retention_type === "custom"}
                            retentionDays={t.retention_days ?? 7}
                          />
                        </td>
                        <td className="px-4 py-2 text-[13px] text-gray-400 tabular-nums">
                          {t.age_days}d
                        </td>
                        <td className="px-4 py-2 text-[13px] font-mono text-gray-500 tabular-nums">
                          {t.score.toFixed(1)}d
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            ) : (
              <div className="p-4 font-mono text-[12px] leading-relaxed">
                {cleanupLogs.length === 0 ? (
                  <span className="text-gray-500">Waiting for logs...</span>
                ) : (
                  cleanupLogs.map((log, i) => (
                    <div
                      key={i}
                      className={`${
                        log.includes("Failed") || log.includes("Aborted")
                          ? "text-red-400"
                          : log.includes("Completed")
                          ? "text-green-400"
                          : log.includes("Target reached")
                          ? "text-yellow-400"
                          : "text-gray-300"
                      }`}
                    >
                      {log}
                    </div>
                  ))
                )}
                <div ref={logEndRef} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
