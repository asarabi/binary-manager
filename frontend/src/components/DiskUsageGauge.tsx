import { formatBytes } from "../utils/format";

interface Props {
  serverName: string;
  usagePercent: number;
  totalBytes: number;
  usedBytes: number;
  freeBytes: number;
}

export default function DiskUsageGauge({
  serverName,
  usagePercent,
  totalBytes,
  usedBytes,
  freeBytes,
}: Props) {
  const barGradient =
    usagePercent >= 90
      ? "from-red-400 to-red-500"
      : usagePercent >= 80
        ? "from-amber-400 to-amber-500"
        : "from-emerald-400 to-emerald-500";

  const textColor =
    usagePercent >= 90
      ? "text-red-600"
      : usagePercent >= 80
        ? "text-amber-600"
        : "text-emerald-600";

  const bgTint =
    usagePercent >= 90
      ? "bg-red-50/50"
      : usagePercent >= 80
        ? "bg-amber-50/50"
        : "bg-emerald-50/30";

  return (
    <div className="bg-white border border-gray-200/60 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
          Disk Usage
        </p>
        <span className="text-[11px] font-semibold text-gray-600 bg-gray-100 px-2.5 py-0.5 rounded-full">
          {serverName}
        </span>
      </div>
      <div className="flex items-baseline gap-1 mb-3">
        <span className={`text-3xl font-bold tabular-nums ${textColor}`}>
          {usagePercent.toFixed(1)}
        </span>
        <span className={`text-sm font-semibold ${textColor}`}>%</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2.5 mb-4 overflow-hidden">
        <div
          className={`h-2.5 rounded-full bg-gradient-to-r ${barGradient} transition-all duration-700 ease-out`}
          style={{ width: `${Math.min(usagePercent, 100)}%` }}
        />
      </div>
      <div className="grid grid-cols-3 gap-2 text-[12px]">
        <div className={`rounded-lg p-2 ${bgTint}`}>
          <div className="font-semibold text-gray-900 tabular-nums">
            {formatBytes(usedBytes)}
          </div>
          <div className="text-gray-400 text-[11px]">Used</div>
        </div>
        <div className="rounded-lg p-2 bg-gray-50/50">
          <div className="font-semibold text-gray-900 tabular-nums">
            {formatBytes(freeBytes)}
          </div>
          <div className="text-gray-400 text-[11px]">Free</div>
        </div>
        <div className="rounded-lg p-2 bg-gray-50/50">
          <div className="font-semibold text-gray-900 tabular-nums">
            {formatBytes(totalBytes)}
          </div>
          <div className="text-gray-400 text-[11px]">Total</div>
        </div>
      </div>
    </div>
  );
}
