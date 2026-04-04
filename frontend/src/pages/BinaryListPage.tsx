import { useState, useEffect } from "react";
import { getProjects, getConfig } from "../api/client";
import ProjectTable from "../components/ProjectTable";
import { Loader2 } from "lucide-react";

interface Project {
  name: string;
  retention_days: number;
  is_custom: boolean;
  build_count: number;
  oldest_build: string | null;
  newest_build: string | null;
  server: string;
}

export default function BinaryListPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [serverNames, setServerNames] = useState<string[]>([]);
  const [activeServer, setActiveServer] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [configRes, projectsRes] = await Promise.all([
          getConfig(),
          getProjects(),
        ]);
        const names: string[] = (configRes.data.binary_servers || []).map(
          (s: { name: string }) => s.name
        );
        setServerNames(names);
        setProjects(projectsRes.data);
        if (names.length > 0) setActiveServer(names[0]);
      } catch {
        setError("Failed to load data");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

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

  const filtered = projects.filter((p) => p.server === activeServer);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-xl font-semibold text-gray-900">Binaries</h2>
        {serverNames.length > 1 && (
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            {serverNames.map((name) => (
              <button
                key={name}
                onClick={() => setActiveServer(name)}
                className={`px-3.5 py-1.5 text-[13px] font-medium rounded-md transition-all ${
                  activeServer === name
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-400 hover:text-gray-600"
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <ProjectTable projects={filtered} />
        {filtered.length === 0 && (
          <p className="text-[13px] text-gray-400 text-center py-12">
            No projects found on this server.
          </p>
        )}
      </div>
    </div>
  );
}
