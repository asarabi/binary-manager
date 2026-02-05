import { useState, useEffect, FormEvent } from "react";
import { getConfig, updateConfig } from "../api/client";
import { Loader2, Plus, Trash2, Save } from "lucide-react";

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
  const [triggerThreshold, setTriggerThreshold] = useState(90);
  const [targetThreshold, setTargetThreshold] = useState(80);
  const [checkInterval, setCheckInterval] = useState(5);
  const [retentionTypes, setRetentionTypes] = useState<RetentionType[]>([]);
  const [projectMappings, setProjectMappings] = useState<ProjectMapping[]>([]);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await getConfig();
        const c = res.data;
        setTriggerThreshold(c.disk.trigger_threshold_percent);
        setTargetThreshold(c.disk.target_threshold_percent);
        setCheckInterval(c.disk.check_interval_minutes);
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
        trigger_threshold_percent: triggerThreshold,
        target_threshold_percent: targetThreshold,
        check_interval_minutes: checkInterval,
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
    (updated[i] as Record<string, string | number>)[field] = value;
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
        {/* Disk Thresholds */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Disk Thresholds
          </h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">
                Trigger (%)
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={triggerThreshold}
                onChange={(e) => setTriggerThreshold(Number(e.target.value))}
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">
                Target (%)
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={targetThreshold}
                onChange={(e) => setTargetThreshold(Number(e.target.value))}
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">
                Check Interval (min)
              </label>
              <input
                type="number"
                min={1}
                value={checkInterval}
                onChange={(e) => setCheckInterval(Number(e.target.value))}
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>
          </div>
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
