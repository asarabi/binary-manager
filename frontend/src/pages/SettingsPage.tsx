import { useState, useEffect, FormEvent } from "react";
import { getConfig, updateConfig, testConnection } from "../api/client";
import { Loader2, Plus, Trash2, Save, Wifi, WifiOff, Server, Clock } from "lucide-react";

interface CustomProject {
  path: string;
  retention_days: number;
}

interface BinaryServer {
  name: string;
  disk_agent_url: string;
  binary_root_path: string;
  project_depth: number;
  trigger_threshold_percent: number;
  target_threshold_percent: number;
  check_interval_minutes: number;
  custom_projects: CustomProject[];
}

interface RetentionConfig {
  default_days: number;
  custom_default_days: number;
  log_retention_days: number;
}

interface ServerTestResult {
  name: string;
  disk_agent: { ok: boolean; message: string };
  file_list: { ok: boolean; message: string };
}

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [servers, setServers] = useState<BinaryServer[]>([]);
  const [retention, setRetention] = useState<RetentionConfig>({
    default_days: 7,
    custom_default_days: 30,
    log_retention_days: 30,
  });
  const [testing, setTesting] = useState(false);
  const [testResults, setTestResults] = useState<ServerTestResult[]>([]);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await getConfig();
        const c = res.data;
        setServers(
          (c.binary_servers || []).map((s: BinaryServer) => ({
            ...s,
            project_depth: s.project_depth ?? 1,
            custom_projects: s.custom_projects ?? [],
          }))
        );
        setRetention(c.retention || { default_days: 7, custom_default_days: 30 });
      } catch {
        setMessage("Failed to load config");
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      await updateConfig({ binary_servers: servers, retention });
      setMessage("Settings saved successfully");
    } catch {
      setMessage("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const addServer = () => {
    setServers([
      ...servers,
      {
        name: "",
        disk_agent_url: "",
        binary_root_path: "/data/binaries",
        project_depth: 1,
        trigger_threshold_percent: 90,
        target_threshold_percent: 80,
        check_interval_minutes: 5,
        custom_projects: [],
      },
    ]);
  };

  const removeServer = (i: number) => {
    setServers(servers.filter((_, idx) => idx !== i));
  };

  const updateServer = (
    i: number,
    field: keyof Omit<BinaryServer, "custom_projects">,
    value: string | number
  ) => {
    const updated = [...servers];
    updated[i] = { ...updated[i], [field]: value };
    setServers(updated);
  };

  const addCustomProject = (serverIdx: number) => {
    const updated = [...servers];
    updated[serverIdx] = {
      ...updated[serverIdx],
      custom_projects: [
        ...updated[serverIdx].custom_projects,
        { path: "", retention_days: retention.custom_default_days },
      ],
    };
    setServers(updated);
  };

  const removeCustomProject = (serverIdx: number, projectIdx: number) => {
    const updated = [...servers];
    updated[serverIdx] = {
      ...updated[serverIdx],
      custom_projects: updated[serverIdx].custom_projects.filter(
        (_, idx) => idx !== projectIdx
      ),
    };
    setServers(updated);
  };

  const updateCustomProject = (
    serverIdx: number,
    projectIdx: number,
    field: keyof CustomProject,
    value: string | number
  ) => {
    const updated = [...servers];
    const projects = [...updated[serverIdx].custom_projects];
    projects[projectIdx] = { ...projects[projectIdx], [field]: value };
    updated[serverIdx] = { ...updated[serverIdx], custom_projects: projects };
    setServers(updated);
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResults([]);
    try {
      await updateConfig({ binary_servers: servers, retention });
      const res = await testConnection();
      setTestResults(res.data);
    } catch {
      setTestResults([]);
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-gray-300" size={24} />
      </div>
    );
  }

  const inputCls = "w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-shadow";
  const labelCls = "block text-[12px] font-medium text-gray-500 mb-1";

  return (
    <div>
      <form onSubmit={handleSave} className="space-y-5 max-w-3xl">
        {/* Header with Save */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Settings</h2>
          <div className="flex items-center gap-3">
            {message && (
              <span className={`text-[13px] ${message.includes("success") ? "text-emerald-500" : "text-red-500"}`}>
                {message}
              </span>
            )}
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white rounded-lg shadow-sm shadow-indigo-200 text-[13px] font-medium hover:from-indigo-600 hover:to-indigo-700 disabled:opacity-40 transition-all"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Save
            </button>
          </div>
        </div>
        {/* Retention Defaults */}
        <div className="bg-white border border-gray-200/60 rounded-xl shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <Clock size={16} className="text-gray-400" strokeWidth={1.8} />
            <h3 className="text-[14px] font-semibold text-gray-900">
              Retention Defaults
            </h3>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Default Retention (days)</label>
              <p className="text-[11px] text-gray-400 mb-1.5">
                Custom 미등록 프로젝트에 적용
              </p>
              <input
                type="number"
                min={1}
                value={retention.default_days}
                onChange={(e) =>
                  setRetention({ ...retention, default_days: Number(e.target.value) })
                }
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Custom Default (days)</label>
              <p className="text-[11px] text-gray-400 mb-1.5">
                Custom project 추가 시 기본값
              </p>
              <input
                type="number"
                min={1}
                value={retention.custom_default_days}
                onChange={(e) =>
                  setRetention({ ...retention, custom_default_days: Number(e.target.value) })
                }
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Log Retention (days)</label>
              <p className="text-[11px] text-gray-400 mb-1.5">
                Cleanup 로그 보관 기간
              </p>
              <input
                type="number"
                min={1}
                value={retention.log_retention_days}
                onChange={(e) =>
                  setRetention({ ...retention, log_retention_days: Number(e.target.value) })
                }
                className={inputCls}
              />
            </div>
          </div>
        </div>

        {/* Binary Servers */}
        <div className="bg-white border border-gray-200/60 rounded-xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Server size={16} className="text-gray-400" strokeWidth={1.8} />
              <h3 className="text-[14px] font-semibold text-gray-900">
                Binary Servers
              </h3>
            </div>
            <button
              type="button"
              onClick={addServer}
              className="flex items-center gap-1 text-[12px] font-medium text-blue-600 hover:text-blue-700"
            >
              <Plus size={13} />
              Add Server
            </button>
          </div>
          <div className="space-y-4">
            {servers.map((server, i) => {
              const result = testResults.find((r) => r.name === server.name);
              return (
                <div key={i} className="border border-gray-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <input
                      type="text"
                      value={server.name}
                      onChange={(e) => updateServer(i, "name", e.target.value)}
                      placeholder="Server name (e.g. custom, mobile)"
                      className="px-3 py-2 border border-gray-200 rounded-lg text-[13px] font-semibold flex-1 mr-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                    />
                    <button
                      type="button"
                      onClick={() => removeServer(i)}
                      className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                  <div>
                    <label className={labelCls}>Disk Agent URL</label>
                    <input
                      type="text"
                      value={server.disk_agent_url}
                      onChange={(e) => updateServer(i, "disk_agent_url", e.target.value)}
                      placeholder="http://server:9090"
                      className={`${inputCls} font-mono`}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Binary Root Path</label>
                      <input
                        type="text"
                        value={server.binary_root_path}
                        onChange={(e) => updateServer(i, "binary_root_path", e.target.value)}
                        placeholder="/data/binaries"
                        className={`${inputCls} font-mono`}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Project Depth</label>
                      <input
                        type="number"
                        min={1}
                        max={5}
                        value={server.project_depth}
                        onChange={(e) => updateServer(i, "project_depth", Number(e.target.value))}
                        className={inputCls}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className={labelCls}>Trigger (%)</label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={server.trigger_threshold_percent}
                        onChange={(e) => updateServer(i, "trigger_threshold_percent", Number(e.target.value))}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Target (%)</label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={server.target_threshold_percent}
                        onChange={(e) => updateServer(i, "target_threshold_percent", Number(e.target.value))}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Interval (min)</label>
                      <input
                        type="number"
                        min={1}
                        value={server.check_interval_minutes}
                        onChange={(e) => updateServer(i, "check_interval_minutes", Number(e.target.value))}
                        className={inputCls}
                      />
                    </div>
                  </div>

                  {/* Custom Projects */}
                  <div className="border-t border-gray-100 pt-3">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-[12px] font-medium text-gray-500">
                        Custom Projects
                      </label>
                      <button
                        type="button"
                        onClick={() => addCustomProject(i)}
                        className="flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:text-blue-700"
                      >
                        <Plus size={11} />
                        Add
                      </button>
                    </div>
                    <div className="space-y-1.5">
                      {server.custom_projects.map((cp, j) => (
                        <div key={j} className="flex items-center gap-2">
                          <input
                            type="text"
                            value={cp.path}
                            onChange={(e) => updateCustomProject(i, j, "path", e.target.value)}
                            placeholder="e.g. automotive/dev"
                            className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-[12px] font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                          />
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min={1}
                              value={cp.retention_days}
                              onChange={(e) => updateCustomProject(i, j, "retention_days", Number(e.target.value))}
                              className="w-16 px-2 py-1.5 border border-gray-200 rounded-lg text-[12px] text-center focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                            />
                            <span className="text-[11px] text-gray-400">d</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeCustomProject(i, j)}
                            className="p-1 text-gray-300 hover:text-red-500 rounded transition-colors"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                      {server.custom_projects.length === 0 && (
                        <p className="text-[11px] text-gray-400">
                          All projects use default retention ({retention.default_days}d)
                        </p>
                      )}
                    </div>
                  </div>

                  {result && (
                    <div className="flex items-center gap-4 text-[12px] pt-2 border-t border-gray-100">
                      <span className={`flex items-center gap-1 ${result.disk_agent.ok ? "text-emerald-500" : "text-red-500"}`}>
                        {result.disk_agent.ok ? <Wifi size={13} /> : <WifiOff size={13} />}
                        Agent: {result.disk_agent.message}
                      </span>
                      <span className={`flex items-center gap-1 ${result.file_list.ok ? "text-emerald-500" : "text-red-500"}`}>
                        {result.file_list.ok ? <Wifi size={13} /> : <WifiOff size={13} />}
                        Files: {result.file_list.message}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
            {servers.length === 0 && (
              <p className="text-[13px] text-gray-400 text-center py-6">
                No servers configured
              </p>
            )}
          </div>
          {servers.length > 0 && (
            <div className="mt-4 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testing}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white rounded-lg hover:from-indigo-600 hover:to-indigo-700 shadow-sm shadow-indigo-200 disabled:opacity-40 text-[13px] font-medium transition-colors"
              >
                {testing ? <Loader2 size={14} className="animate-spin" /> : <Wifi size={14} />}
                Test All Connections
              </button>
            </div>
          )}
        </div>

      </form>
    </div>
  );
}
