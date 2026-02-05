import { useNavigate } from "react-router-dom";
import RetentionBadge from "./RetentionBadge";

interface Project {
  name: string;
  retention_type: string;
  build_count: number;
  oldest_build: string | null;
  newest_build: string | null;
}

interface Props {
  projects: Project[];
}

export default function ProjectTable({ projects }: Props) {
  const navigate = useNavigate();

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Project
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Type
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Builds
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Range
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {projects.map((p) => (
            <tr
              key={p.name}
              className="hover:bg-gray-50 cursor-pointer"
              onClick={() => navigate(`/binaries/${p.name}`)}
            >
              <td className="px-4 py-3 text-sm font-medium text-gray-900">
                {p.name}
              </td>
              <td className="px-4 py-3 text-sm">
                <RetentionBadge type={p.retention_type} />
              </td>
              <td className="px-4 py-3 text-sm text-gray-600">
                {p.build_count}
              </td>
              <td className="px-4 py-3 text-sm text-gray-500">
                {p.oldest_build && p.newest_build
                  ? `${p.oldest_build} ~ ${p.newest_build}`
                  : "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
