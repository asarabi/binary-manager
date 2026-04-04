import { useState, useEffect } from "react";
import { getCleanupRuns, getLogs } from "../api/client";
import RetentionBadge from "../components/RetentionBadge";
import { Loader2, ChevronDown, ChevronRight, Trash2, Eye } from "lucide-react";

interface CleanupRun {
  id: number;
  started_at: string;
  finished_at: string | null;
  trigger: string;
  dry_run: boolean;
  disk_usage_before: number | null;
  disk_usage_after: number | null;
  builds_deleted: number;
  bytes_freed: number;
  status: string;
  error_message: string | null;
}

interface LogEntry {
  id: number;
  run_id: number;
  deleted_at: string;
  server_name: string;
  project_name: string;
  build_number: string;
  retention_type: string;
  age_days: number;
  size_bytes: number;
  score: number;
  dry_run: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "-";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function formatKST(dateStr: string): string {
  return new Date(dateStr + "Z").toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
  });
}

function groupByServer(logs: LogEntry[]): Record<string, LogEntry[]> {
  const groups: Record<string, LogEntry[]> = {};
  for (const log of logs) {
    const key = log.server_name || "unknown";
    if (!groups[key]) groups[key] = [];
    groups[key].push(log);
  }
  return groups;
}

export default function LogsPage() {
  const [runs, setRuns] = useState<CleanupRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRun, setExpandedRun] = useState<number | null>(null);
  const [runLogs, setRunLogs] = useState<Record<number, LogEntry[]>>({});

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await getCleanupRuns();
        setRuns(res.data);
      } catch {
        // error
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  const toggleRun = async (runId: number) => {
    if (expandedRun === runId) {
      setExpandedRun(null);
      return;
    }
    setExpandedRun(runId);
    if (!runLogs[runId]) {
      const res = await getLogs({ run_id: runId, page_size: 200 });
      setRunLogs({ ...runLogs, [runId]: res.data.items });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-gray-300" size={24} />
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-8">
        Cleanup Logs
      </h2>

      {runs.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center text-[13px] text-gray-400">
          No cleanup runs yet
        </div>
      ) : (
        <div className="space-y-2">
          {runs.map((run) => (
            <div
              key={run.id}
              className="bg-white border border-gray-200 rounded-xl overflow-hidden"
            >
              <button
                onClick={() => toggleRun(run.id)}
                className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50/50 text-left transition-colors"
              >
                <div className="flex items-center gap-3">
                  {expandedRun === run.id ? (
                    <ChevronDown size={15} className="text-gray-300" />
                  ) : (
                    <ChevronRight size={15} className="text-gray-300" />
                  )}
                  {run.dry_run ? (
                    <Eye size={15} className="text-blue-400" />
                  ) : (
                    <Trash2 size={15} className="text-red-400" />
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-semibold text-gray-900">
                        {run.dry_run ? "Dry Run" : "Cleanup"}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          run.status === "completed"
                            ? "bg-emerald-50 text-emerald-600"
                            : run.status === "failed"
                              ? "bg-red-50 text-red-600"
                              : "bg-amber-50 text-amber-600"
                        }`}
                      >
                        {run.status}
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-50 text-gray-400">
                        {run.trigger === "manual" ? "manual" : "scheduled"}
                      </span>
                    </div>
                    <span className="text-[11px] text-gray-400">
                      {formatKST(run.started_at)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-6 text-[12px]">
                  <div className="text-right">
                    <div className="text-[10px] text-gray-400 uppercase">
                      {run.dry_run ? "Target" : "Deleted"}
                    </div>
                    <div className="font-semibold text-gray-900 tabular-nums">
                      {run.builds_deleted}
                    </div>
                  </div>
                  {!run.dry_run && (
                    <div className="text-right">
                      <div className="text-[10px] text-gray-400 uppercase">
                        Freed
                      </div>
                      <div className="font-semibold text-gray-900">
                        {formatBytes(run.bytes_freed)}
                      </div>
                    </div>
                  )}
                  {run.disk_usage_before != null &&
                    run.disk_usage_after != null && (
                      <div className="text-right">
                        <div className="text-[10px] text-gray-400 uppercase">
                          Disk
                        </div>
                        <div className="font-semibold text-gray-900 tabular-nums">
                          {run.disk_usage_before.toFixed(1)}%
                          {!run.dry_run && (
                            <span className="text-gray-400">
                              {" "}
                              <span
                                className={
                                  run.disk_usage_after < run.disk_usage_before
                                    ? "text-emerald-500"
                                    : ""
                                }
                              >
                                {run.disk_usage_after.toFixed(1)}%
                              </span>
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                </div>
              </button>

              {expandedRun === run.id && (
                <div className="border-t border-gray-100 px-5 py-4">
                  {run.error_message && (
                    <div className="bg-red-50 border border-red-100 rounded-lg p-3 mb-3 text-[12px] text-red-600">
                      {run.error_message}
                    </div>
                  )}
                  {runLogs[run.id] ? (
                    runLogs[run.id].length > 0 ? (
                      <div className="space-y-4">
                        {Object.entries(groupByServer(runLogs[run.id])).map(
                          ([serverName, logs]) => (
                            <div key={serverName}>
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-[11px] font-medium text-gray-500 bg-gray-50 px-2 py-0.5 rounded">
                                  {serverName}
                                </span>
                                <span className="text-[11px] text-gray-400">
                                  {logs.length} builds
                                </span>
                              </div>
                              <table className="min-w-full text-[12px]">
                                <thead>
                                  <tr className="text-left text-[10px] text-gray-400 uppercase tracking-wider">
                                    <th className="pb-2 pr-4">#</th>
                                    <th className="pb-2 pr-4">Project</th>
                                    <th className="pb-2 pr-4">Build</th>
                                    <th className="pb-2 pr-4">Type</th>
                                    <th className="pb-2 pr-4">Age</th>
                                    {!run.dry_run && (
                                      <th className="pb-2 pr-4">Size</th>
                                    )}
                                    <th className="pb-2">Remaining</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {logs.map((log, i) => (
                                    <tr
                                      key={log.id}
                                      className="border-t border-gray-50"
                                    >
                                      <td className="py-1.5 pr-4 text-gray-300 tabular-nums">
                                        {i + 1}
                                      </td>
                                      <td className="py-1.5 pr-4 font-medium text-gray-900">
                                        {log.project_name}
                                      </td>
                                      <td className="py-1.5 pr-4 font-mono text-gray-700">
                                        {log.build_number}
                                      </td>
                                      <td className="py-1.5 pr-4">
                                        <RetentionBadge
                                          isCustom={
                                            log.retention_type === "custom"
                                          }
                                          retentionDays={
                                            log.score > 0
                                              ? Math.round(
                                                  log.age_days + log.score
                                                )
                                              : 7
                                          }
                                        />
                                      </td>
                                      <td className="py-1.5 pr-4 text-gray-500 tabular-nums">
                                        {log.age_days.toFixed(1)}d
                                      </td>
                                      {!run.dry_run && (
                                        <td className="py-1.5 pr-4 text-gray-500">
                                          {formatBytes(log.size_bytes)}
                                        </td>
                                      )}
                                      <td className="py-1.5 font-mono text-gray-400 tabular-nums">
                                        {log.score.toFixed(1)}d
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )
                        )}
                      </div>
                    ) : (
                      <p className="text-[13px] text-gray-400">
                        No builds deleted
                      </p>
                    )
                  ) : (
                    <Loader2
                      className="animate-spin text-gray-300 mx-auto"
                      size={20}
                    />
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
