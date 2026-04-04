import { useNavigate } from "react-router-dom";
import RetentionBadge from "./RetentionBadge";

interface Project {
  name: string;
  retention_days: number;
  is_custom: boolean;
  build_count: number;
  oldest_build: string | null;
  newest_build: string | null;
  server: string;
}

interface Props {
  projects: Project[];
}

export default function ProjectTable({ projects }: Props) {
  const navigate = useNavigate();

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="px-4 py-3 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider">
              Project
            </th>
            <th className="px-4 py-3 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider">
              Retention
            </th>
            <th className="px-4 py-3 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider">
              Builds
            </th>
            <th className="px-4 py-3 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider">
              Range
            </th>
          </tr>
        </thead>
        <tbody>
          {projects.map((p) => (
            <tr
              key={`${p.server}:${p.name}`}
              className="border-b border-gray-50 hover:bg-gray-50/50 cursor-pointer transition-colors"
              onClick={() =>
                navigate(
                  `/binaries/detail/${p.name}?server=${encodeURIComponent(p.server)}`
                )
              }
            >
              <td className="px-4 py-3 text-[13px] font-medium text-gray-900">
                {p.name}
              </td>
              <td className="px-4 py-3">
                <RetentionBadge
                  isCustom={p.is_custom}
                  retentionDays={p.retention_days}
                />
              </td>
              <td className="px-4 py-3 text-[13px] text-gray-500 tabular-nums">
                {p.build_count}
              </td>
              <td className="px-4 py-3 text-[13px] text-gray-400 font-mono">
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
