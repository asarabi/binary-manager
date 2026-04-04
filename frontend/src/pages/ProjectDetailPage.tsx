import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getProjectBuilds, deleteBuild } from "../api/client";
import RetentionBadge from "../components/RetentionBadge";
import { ArrowLeft, Trash2, Loader2, AlertTriangle } from "lucide-react";

interface Build {
  build_number: string;
  modified_at: string;
  age_days: number;
  retention_days: number;
  remaining_days: number;
  expired: boolean;
  size_bytes: number;
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

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
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
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
