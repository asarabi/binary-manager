import { useState, useEffect, FormEvent } from "react";
import { getConfig, updateConfig, testConnection } from "../api/client";
import { Loader2, Plus, Trash2, Save, Wifi, WifiOff, Server } from "lucide-react";

interface BinaryServer {
  name: string;
  webdav_url: string;
  disk_agent_url: string;
  binary_root_path: string;
  trigger_threshold_percent: number;
  target_threshold_percent: number;
  check_interval_minutes: number;
}

interface ServerTestResult {
  name: string;
  webdav: { ok: boolean; message: string };
  disk_agent: { ok: boolean; message: string };
}

interface RetentionType {
  name: string;
  retention_days: number;
  priority: number;
}

interface ProjectMapping {
  pattern: string;
  type: string;
}

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [servers, setServers] = useState<BinaryServer[]>([]);
  const [testing, setTesting] = useState(false);
  const [testResults, setTestResults] = useState<ServerTestResult[]>([]);
  const [retentionTypes, setRetentionTypes] = useState<RetentionType[]>([]);
  const [projectMappings, setProjectMappings] = useState<ProjectMapping[]>([]);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await getConfig();
        const c = res.data;
        setServers(c.binary_servers || []);
        setRetentionTypes(c.retention_types);
        setProjectMappings(c.project_mappings);
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
      await updateConfig({
        binary_servers: servers,
        retention_types: retentionTypes,
        project_mappings: projectMappings,
      });
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
      { name: "", webdav_url: "", disk_agent_url: "", binary_root_path: "/data/binaries", trigger_threshold_percent: 90, target_threshold_percent: 80, check_interval_minutes: 5 },
    ]);
  };

  const removeServer = (i: number) => {
    setServers(servers.filter((_, idx) => idx !== i));
  };

  const updateServer = (i: number, field: keyof BinaryServer, value: string | number) => {
    const updated = [...servers];
    updated[i] = { ...updated[i], [field]: value };
    setServers(updated);
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResults([]);
    try {
      await updateConfig({ binary_servers: servers });
      const res = await testConnection();
      setTestResults(res.data);
    } catch {
      setTestResults([]);
    } finally {
      setTesting(false);
    }
  };

  const addRetentionType = () => {
    setRetentionTypes([
      ...retentionTypes,
      { name: "", retention_days: 7, priority: 1 },
    ]);
  };

  const removeRetentionType = (i: number) => {
    setRetentionTypes(retentionTypes.filter((_, idx) => idx !== i));
  };

  const updateRetention = (
    i: number,
    field: keyof RetentionType,
    value: string | number
  ) => {
    const updated = [...retentionTypes];
    updated[i] = { ...updated[i], [field]: value };
    setRetentionTypes(updated);
  };

  const addMapping = () => {
    setProjectMappings([...projectMappings, { pattern: "*", type: "" }]);
  };

  const removeMapping = (i: number) => {
    setProjectMappings(projectMappings.filter((_, idx) => idx !== i));
  };

  const updateMapping = (
    i: number,
    field: keyof ProjectMapping,
    value: string
  ) => {
    const updated = [...projectMappings];
    updated[i][field] = value;
    setProjectMappings(updated);
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
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Settings</h2>

      <form onSubmit={handleSave} className="space-y-6 max-w-3xl">
        {/* Binary Servers */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Server size={20} className="text-gray-700" />
              <h3 className="text-lg font-semibold text-gray-900">
                Binary Servers
              </h3>
            </div>
            <button
              type="button"
              onClick={addServer}
              className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
            >
              <Plus size={14} />
              Add Server
            </button>
          </div>
          <div className="space-y-4">
            {servers.map((server, i) => {
              const result = testResults.find((r) => r.name === server.name);
              return (
                <div key={i} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <input
                      type="text"
                      value={server.name}
                      onChange={(e) => updateServer(i, "name", e.target.value)}
                      placeholder="Server name (e.g. custom, mobile)"
                      className="px-3 py-2 border rounded-md text-sm font-semibold flex-1 mr-2"
                    />
                    <button
                      type="button"
                      onClick={() => removeServer(i)}
                      className="p-1 text-red-500 hover:bg-red-50 rounded"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">
                        WebDAV URL
                      </label>
                      <input
                        type="text"
                        value={server.webdav_url}
                        onChange={(e) => updateServer(i, "webdav_url", e.target.value)}
                        placeholder="http://server:8080"
                        className="w-full px-3 py-2 border rounded-md text-sm font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">
                        Disk Agent URL
                      </label>
                      <input
                        type="text"
                        value={server.disk_agent_url}
                        onChange={(e) => updateServer(i, "disk_agent_url", e.target.value)}
                        placeholder="http://server:9090"
                        className="w-full px-3 py-2 border rounded-md text-sm font-mono"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">
                      Binary Root Path
                    </label>
                    <input
                      type="text"
                      value={server.binary_root_path}
                      onChange={(e) => updateServer(i, "binary_root_path", e.target.value)}
                      placeholder="/data/binaries"
                      className="w-full px-3 py-2 border rounded-md text-sm font-mono"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Trigger (%)</label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={server.trigger_threshold_percent}
                        onChange={(e) => updateServer(i, "trigger_threshold_percent", Number(e.target.value))}
                        className="w-full px-3 py-2 border rounded-md text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Target (%)</label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={server.target_threshold_percent}
                        onChange={(e) => updateServer(i, "target_threshold_percent", Number(e.target.value))}
                        className="w-full px-3 py-2 border rounded-md text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Check Interval (min)</label>
                      <input
                        type="number"
                        min={1}
                        value={server.check_interval_minutes}
                        onChange={(e) => updateServer(i, "check_interval_minutes", Number(e.target.value))}
                        className="w-full px-3 py-2 border rounded-md text-sm"
                      />
                    </div>
                  </div>
                  {result && (
                    <div className="flex items-center gap-4 text-sm pt-2 border-t">
                      <span className={`flex items-center gap-1 ${result.webdav.ok ? "text-green-600" : "text-red-600"}`}>
                        {result.webdav.ok ? <Wifi size={14} /> : <WifiOff size={14} />}
                        WebDAV: {result.webdav.message}
                      </span>
                      <span className={`flex items-center gap-1 ${result.disk_agent.ok ? "text-green-600" : "text-red-600"}`}>
                        {result.disk_agent.ok ? <Wifi size={14} /> : <WifiOff size={14} />}
                        Agent: {result.disk_agent.message}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
            {servers.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">
                No servers configured. Click "Add Server" to add one.
              </p>
            )}
          </div>
          {servers.length > 0 && (
            <div className="mt-4 pt-3 border-t">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testing}
                className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-800 disabled:opacity-50 text-sm"
              >
                {testing ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Wifi size={14} />
                )}
                Test All Connections
              </button>
            </div>
          )}
        </div>

        {/* Retention Types */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Retention Types
            </h3>
            <button
              type="button"
              onClick={addRetentionType}
              className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
            >
              <Plus size={14} />
              Add
            </button>
          </div>
          <div className="space-y-3">
            {retentionTypes.map((rt, i) => (
              <div key={i} className="flex items-center gap-3">
                <input
                  type="text"
                  value={rt.name}
                  onChange={(e) => updateRetention(i, "name", e.target.value)}
                  placeholder="Type name"
                  className="flex-1 px-3 py-2 border rounded-md text-sm"
                />
                <div className="flex items-center gap-1">
                  <label className="text-xs text-gray-500">Days:</label>
                  <input
                    type="number"
                    min={1}
                    value={rt.retention_days}
                    onChange={(e) =>
                      updateRetention(i, "retention_days", Number(e.target.value))
                    }
                    className="w-20 px-2 py-2 border rounded-md text-sm"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <label className="text-xs text-gray-500">Priority:</label>
                  <input
                    type="number"
                    min={1}
                    value={rt.priority}
                    onChange={(e) =>
                      updateRetention(i, "priority", Number(e.target.value))
                    }
                    className="w-20 px-2 py-2 border rounded-md text-sm"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeRetentionType(i)}
                  className="p-1 text-red-500 hover:bg-red-50 rounded"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Project Mappings */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Project Mappings
            </h3>
            <button
              type="button"
              onClick={addMapping}
              className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
            >
              <Plus size={14} />
              Add
            </button>
          </div>
          <div className="space-y-3">
            {projectMappings.map((pm, i) => (
              <div key={i} className="flex items-center gap-3">
                <input
                  type="text"
                  value={pm.pattern}
                  onChange={(e) => updateMapping(i, "pattern", e.target.value)}
                  placeholder="Glob pattern (e.g. nightly-*)"
                  className="flex-1 px-3 py-2 border rounded-md text-sm font-mono"
                />
                <select
                  value={pm.type}
                  onChange={(e) => updateMapping(i, "type", e.target.value)}
                  className="px-3 py-2 border rounded-md text-sm"
                >
                  <option value="">Select type...</option>
                  {retentionTypes.map((rt) => (
                    <option key={rt.name} value={rt.name}>
                      {rt.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => removeMapping(i)}
                  className="p-1 text-red-500 hover:bg-red-50 rounded"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Save */}
        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Save size={16} />
            )}
            Save Settings
          </button>
          {message && (
            <span
              className={`text-sm ${message.includes("success") ? "text-green-600" : "text-red-600"}`}
            >
              {message}
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
