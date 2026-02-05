import { useState, useEffect } from "react";
import { getProjects } from "../api/client";
import ProjectTable from "../components/ProjectTable";
import { Loader2 } from "lucide-react";

export default function BinaryListPage() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await getProjects();
        setProjects(res.data);
      } catch {
        setError("Failed to load projects");
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

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
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Binaries</h2>
      <div className="bg-white rounded-lg shadow">
        <ProjectTable projects={projects} />
      </div>
    </div>
  );
}
