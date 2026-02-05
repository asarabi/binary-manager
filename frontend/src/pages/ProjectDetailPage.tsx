import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getProjectBuilds, deleteBuild } from "../api/client";
import RetentionBadge from "../components/RetentionBadge";
import { ArrowLeft, Trash2, Loader2, AlertTriangle } from "lucide-react";

interface Build {
  build_number: string;
  modified_at: string;
  age_days: number;
  retention_type: string;
  retention_days: number;
  expired: boolean;
  score: number;
  size_bytes: number;
}

interface ProjectDetail {
  name: string;
  retention_type: string;
  builds: Build[];
}

export default function ProjectDetailPage() {
  const { project } = useParams<{ project: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchBuilds = async () => {
    if (!project) return;
    try {
      const res = await getProjectBuilds(project);
      setData(res.data);
    } catch {
      // error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBuilds();
  }, [project]);

  const handleDelete = async (buildNumber: string) => {
    if (!project) return;
    if (!confirm(`Delete ${project}/${buildNumber}?`)) return;
    setDeleting(buildNumber);
    try {
      await deleteBuild(project, buildNumber);
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
        <Loader2 className="animate-spin text-gray-400" size={32} />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate("/binaries")}
          className="p-1 hover:bg-gray-200 rounded"
        >
          <ArrowLeft size={20} />
        </button>
        <h2 className="text-2xl font-bold text-gray-900">{data.name}</h2>
        <RetentionBadge type={data.retention_type} />
      </div>

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Build
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Modified
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Age
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Score
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {data.builds.map((b) => (
              <tr key={b.build_number} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-mono text-gray-900">
                  {b.build_number}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {new Date(b.modified_at).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {b.age_days.toFixed(1)}d
                </td>
                <td className="px-4 py-3 text-sm">
                  {b.expired ? (
                    <span className="flex items-center gap-1 text-red-600">
                      <AlertTriangle size={14} />
                      Expired
                    </span>
                  ) : (
                    <span className="text-green-600">Active</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500 font-mono">
                  {b.score.toFixed(1)}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => handleDelete(b.build_number)}
                    disabled={deleting === b.build_number}
                    className="p-1 text-red-500 hover:bg-red-50 rounded disabled:opacity-50"
                  >
                    {deleting === b.build_number ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Trash2 size={16} />
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
