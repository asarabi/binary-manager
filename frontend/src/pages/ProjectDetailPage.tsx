import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  getProjectBuilds,
  deleteBuild,
  setBuildRetention,
  removeBuildRetention,
} from "../api/client";
import RetentionBadge from "../components/RetentionBadge";
import {
  ArrowLeft,
  Trash2,
  Loader2,
  AlertTriangle,
  Clock,
  X,
  Check,
} from "lucide-react";

interface Build {
  build_number: string;
  modified_at: string;
  age_days: number;
  retention_days: number;
  remaining_days: number;
  expired: boolean;
  size_bytes: number;
  has_override: boolean;
}

interface ProjectDetail {
  name: string;
  retention_days: number;
  is_custom: boolean;
  builds: Build[];
}

export default function ProjectDetailPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const project = location.pathname.replace(/^\/binaries\/detail\//, "");
  const server =
    new URLSearchParams(location.search).get("server") || undefined;

  const [data, setData] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [editingBuild, setEditingBuild] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<number>(0);
  const [saving, setSaving] = useState(false);

  const fetchBuilds = async () => {
    if (!project) return;
    try {
      const res = await getProjectBuilds(project, server);
      setData(res.data);
    } catch {
      // error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBuilds();
  }, [project, server]);

  const handleDelete = async (buildNumber: string) => {
    if (!project) return;
    if (!confirm(`Delete ${project}/${buildNumber}?`)) return;
    setDeleting(buildNumber);
    try {
      await deleteBuild(project, buildNumber, server);
      fetchBuilds();
    } catch {
      alert("Failed to delete build");
    } finally {
      setDeleting(null);
    }
  };

  const handleEditStart = (build: Build) => {
    setEditingBuild(build.build_number);
    setEditValue(build.retention_days);
  };

  const handleEditSave = async () => {
    if (!editingBuild || !project) return;
    setSaving(true);
    try {
      await setBuildRetention(project, editingBuild, editValue, server);
      setEditingBuild(null);
      fetchBuilds();
    } catch {
      alert("Failed to set retention");
    } finally {
      setSaving(false);
    }
  };

  const handleOverrideRemove = async (buildNumber: string) => {
    if (!project) return;
    try {
      await removeBuildRetention(project, buildNumber, server);
      fetchBuilds();
    } catch {
      alert("Failed to remove override");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-gray-300" size={24} />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={() => navigate("/binaries")}
          className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <h2 className="text-xl font-semibold text-gray-900">{data.name}</h2>
        <RetentionBadge
          isCustom={data.is_custom}
          retentionDays={data.retention_days}
        />
      </div>

      <div className="bg-white border border-gray-200/60 rounded-xl shadow-sm overflow-hidden">
        <table className="min-w-full">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="px-4 py-3 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider">
                Build
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider">
                Modified
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider">
                Age
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider">
                Retention
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider">
                Remaining
              </th>
              <th className="px-4 py-3 text-right text-[11px] font-medium text-gray-400 uppercase tracking-wider">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {data.builds.map((b) => (
              <tr
                key={b.build_number}
                className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors"
              >
                <td className="px-4 py-3 text-[13px] font-mono font-medium text-gray-900">
                  {b.build_number}
                </td>
                <td className="px-4 py-3 text-[13px] text-gray-500">
                  {new Date(b.modified_at).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-[13px] text-gray-500 tabular-nums">
                  {b.age_days.toFixed(1)}d
                </td>
                <td className="px-4 py-3 text-[13px]">
                  {editingBuild === b.build_number ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={1}
                        value={editValue}
                        onChange={(e) => setEditValue(Number(e.target.value))}
                        className="w-16 px-2 py-1 border border-gray-200 rounded text-[12px] text-center focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleEditSave();
                          if (e.key === "Escape") setEditingBuild(null);
                        }}
                      />
                      <span className="text-[11px] text-gray-400">d</span>
                      <button
                        onClick={handleEditSave}
                        disabled={saving}
                        className="p-1 text-emerald-500 hover:bg-emerald-50 rounded transition-colors"
                      >
                        {saving ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <Check size={13} />
                        )}
                      </button>
                      <button
                        onClick={() => setEditingBuild(null)}
                        className="p-1 text-gray-400 hover:bg-gray-100 rounded transition-colors"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleEditStart(b)}
                      className="inline-flex items-center gap-1 text-[13px] text-gray-600 hover:text-gray-900 group"
                    >
                      <span className="tabular-nums">{b.retention_days}d</span>
                      {b.has_override && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded-full font-medium">
                          override
                        </span>
                      )}
                      <Clock
                        size={12}
                        className="text-gray-300 group-hover:text-gray-500 transition-colors"
                      />
                    </button>
                  )}
                </td>
                <td className="px-4 py-3 text-[13px]">
                  {b.expired ? (
                    <span className="inline-flex items-center gap-1 text-red-500">
                      <AlertTriangle size={13} />
                      Expired
                    </span>
                  ) : (
                    <span className="text-emerald-500">Active</span>
                  )}
                </td>
                <td className="px-4 py-3 text-[13px] text-gray-400 font-mono tabular-nums">
                  {b.remaining_days.toFixed(1)}d
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    {b.has_override && (
                      <button
                        onClick={() => handleOverrideRemove(b.build_number)}
                        className="p-1.5 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Remove retention override"
                      >
                        <X size={14} />
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(b.build_number)}
                      disabled={deleting === b.build_number}
                      className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg disabled:opacity-40 transition-colors"
                    >
                      {deleting === b.build_number ? (
                        <Loader2 size={15} className="animate-spin" />
                      ) : (
                        <Trash2 size={15} />
                      )}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
