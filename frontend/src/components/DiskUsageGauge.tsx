interface Props {
  serverName: string;
  usagePercent: number;
  totalBytes: number;
  usedBytes: number;
  freeBytes: number;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export default function DiskUsageGauge({
  serverName,
  usagePercent,
  totalBytes,
  usedBytes,
  freeBytes,
}: Props) {
  const color =
    usagePercent >= 90
      ? "bg-red-500"
      : usagePercent >= 80
        ? "bg-amber-500"
        : "bg-emerald-500";

  const textColor =
    usagePercent >= 90
      ? "text-red-600"
      : usagePercent >= 80
        ? "text-amber-600"
        : "text-emerald-600";

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">
          Disk Usage
        </p>
        <span className="text-[11px] font-medium text-gray-500 bg-gray-50 px-2 py-0.5 rounded">
          {serverName}
        </span>
      </div>
      <div className="flex items-baseline gap-1 mb-3">
        <span className={`text-3xl font-semibold tabular-nums ${textColor}`}>
          {usagePercent.toFixed(1)}
        </span>
        <span className={`text-sm font-medium ${textColor}`}>%</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2 mb-4">
        <div
          className={`h-2 rounded-full ${color} transition-all duration-500`}
          style={{ width: `${Math.min(usagePercent, 100)}%` }}
        />
      </div>
      <div className="grid grid-cols-3 gap-2 text-[12px]">
        <div>
          <div className="font-medium text-gray-900 tabular-nums">
            {formatBytes(usedBytes)}
          </div>
          <div className="text-gray-400">Used</div>
        </div>
        <div>
          <div className="font-medium text-gray-900 tabular-nums">
            {formatBytes(freeBytes)}
          </div>
          <div className="text-gray-400">Free</div>
        </div>
        <div>
          <div className="font-medium text-gray-900 tabular-nums">
            {formatBytes(totalBytes)}
          </div>
          <div className="text-gray-400">Total</div>
        </div>
      </div>
    </div>
  );
}
