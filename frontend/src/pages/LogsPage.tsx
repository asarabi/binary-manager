import { useState, useEffect } from "react";
import { getCleanupRuns, getLogs } from "../api/client";
import { Loader2, ChevronDown, ChevronRight } from "lucide-react";

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
  project_name: string;
  build_number: string;
  retention_type: string;
  age_days: number;
  size_bytes: number;
  score: number;
  dry_run: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
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
        <Loader2 className="animate-spin text-gray-400" size={32} />
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Cleanup Logs</h2>

      {runs.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          No cleanup runs yet
        </div>
      ) : (
        <div className="space-y-3">
          {runs.map((run) => (
            <div key={run.id} className="bg-white rounded-lg shadow">
              <button
                onClick={() => toggleRun(run.id)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 rounded-lg"
              >
                <div className="flex items-center gap-4">
                  {expandedRun === run.id ? (
                    <ChevronDown size={16} />
                  ) : (
                    <ChevronRight size={16} />
                  )}
                  <span className="text-sm font-medium">
                    Run #{run.id}
                  </span>
                  <span className="text-xs text-gray-500">
                    {new Date(run.started_at).toLocaleString()}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium ${
                      run.status === "completed"
                        ? "bg-green-100 text-green-700"
                        : run.status === "failed"
                          ? "bg-red-100 text-red-700"
                          : "bg-yellow-100 text-yellow-700"
                    }`}
                  >
                    {run.status}
                  </span>
                  {run.dry_run && (
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                      dry run
                    </span>
                  )}
                  <span className="text-xs text-gray-500">
                    {run.trigger}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <span>{run.builds_deleted} builds</span>
                  <span>{formatBytes(run.bytes_freed)}</span>
                  {run.disk_usage_before != null &&
                    run.disk_usage_after != null && (
                      <span>
                        {run.disk_usage_before.toFixed(1)}% →{" "}
                        {run.disk_usage_after.toFixed(1)}%
                      </span>
                    )}
                </div>
              </button>

              {expandedRun === run.id && (
                <div className="border-t px-4 py-3">
                  {run.error_message && (
                    <div className="bg-red-50 border border-red-200 rounded p-3 mb-3 text-sm text-red-700">
                      {run.error_message}
                    </div>
                  )}
                  {runLogs[run.id] ? (
                    runLogs[run.id].length > 0 ? (
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs text-gray-500 uppercase">
                            <th className="pb-2">Project</th>
                            <th className="pb-2">Build</th>
                            <th className="pb-2">Type</th>
                            <th className="pb-2">Age</th>
                            <th className="pb-2">Size</th>
                            <th className="pb-2">Score</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {runLogs[run.id].map((log) => (
                            <tr key={log.id}>
                              <td className="py-1.5">{log.project_name}</td>
                              <td className="py-1.5 font-mono">
                                {log.build_number}
                              </td>
                              <td className="py-1.5">{log.retention_type}</td>
                              <td className="py-1.5">
                                {log.age_days.toFixed(1)}d
                              </td>
                              <td className="py-1.5">
                                {formatBytes(log.size_bytes)}
                              </td>
                              <td className="py-1.5 font-mono">
                                {log.score.toFixed(1)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <p className="text-gray-500 text-sm">
                        No deletions in this run
                      </p>
                    )
                  ) : (
                    <Loader2
                      className="animate-spin text-gray-400 mx-auto"
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
