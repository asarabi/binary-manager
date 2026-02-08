import { useState, useEffect } from "react";
import { getProjects, getProjectBuilds } from "../api/client";
import ProjectTable from "../components/ProjectTable";
import RetentionBadge from "../components/RetentionBadge";
import { Loader2, AlertTriangle } from "lucide-react";

interface Project {
  name: string;
  retention_type: string;
  build_count: number;
  oldest_build: string | null;
  newest_build: string | null;
}

interface Build {
  project: string;
  build_number: string;
  modified_at: string;
  age_days: number;
  retention_type: string;
  retention_days: number;
  expired: boolean;
  score: number;
}

export default function BinaryListPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [allBuilds, setAllBuilds] = useState<Build[]>([]);
  const [loading, setLoading] = useState(true);
  const [buildsLoading, setBuildsLoading] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"projects" | "all">("projects");

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const res = await getProjects();
        setProjects(res.data);
      } catch {
        setError("Failed to load projects");
      } finally {
        setLoading(false);
      }
    };
    fetchProjects();
  }, []);

  useEffect(() => {
    if (tab !== "all" || allBuilds.length > 0) return;
    const fetchAllBuilds = async () => {
      setBuildsLoading(true);
      try {
        const results = await Promise.all(
          projects.map((p) => getProjectBuilds(p.name))
        );
        const builds: Build[] = results.flatMap((res) =>
          res.data.builds.map((b: Omit<Build, "project">) => ({
            ...b,
            project: res.data.name,
          }))
        );
        builds.sort((a, b) => a.score - b.score);
        setAllBuilds(builds);
      } catch {
        setError("Failed to load builds");
      } finally {
        setBuildsLoading(false);
      }
    };
    fetchAllBuilds();
  }, [tab, projects]);

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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Binaries</h2>
        <div className="flex bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setTab("projects")}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
              tab === "projects"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Projects
          </button>
          <button
            onClick={() => setTab("all")}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
              tab === "all"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            All Builds
          </button>
        </div>
      </div>

      {tab === "projects" ? (
        <div className="bg-white rounded-lg shadow">
          <ProjectTable projects={projects} />
        </div>
      ) : buildsLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="animate-spin text-gray-400" size={32} />
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Project
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Build
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Type
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
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {allBuilds.map((b) => (
                <tr key={`${b.project}-${b.build_number}`} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {b.project}
                  </td>
                  <td className="px-4 py-3 text-sm font-mono text-gray-900">
                    {b.build_number}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <RetentionBadge type={b.retention_type} />
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
