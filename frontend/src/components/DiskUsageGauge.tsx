interface Props {
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
  usagePercent,
  totalBytes,
  usedBytes,
  freeBytes,
}: Props) {
  const color =
    usagePercent >= 90
      ? "bg-red-500"
      : usagePercent >= 80
        ? "bg-yellow-500"
        : "bg-green-500";

  const textColor =
    usagePercent >= 90
      ? "text-red-600"
      : usagePercent >= 80
        ? "text-yellow-600"
        : "text-green-600";

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-sm font-medium text-gray-500 mb-4">Disk Usage</h3>
      <div className="flex items-end gap-4 mb-4">
        <span className={`text-4xl font-bold ${textColor}`}>
          {usagePercent.toFixed(1)}%
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
        <div
          className={`h-3 rounded-full ${color} transition-all duration-500`}
          style={{ width: `${Math.min(usagePercent, 100)}%` }}
        />
      </div>
      <div className="grid grid-cols-3 gap-2 text-sm text-gray-500">
        <div>
          <div className="font-medium text-gray-900">
            {formatBytes(usedBytes)}
          </div>
          <div>Used</div>
        </div>
        <div>
          <div className="font-medium text-gray-900">
            {formatBytes(freeBytes)}
          </div>
          <div>Free</div>
        </div>
        <div>
          <div className="font-medium text-gray-900">
            {formatBytes(totalBytes)}
          </div>
          <div>Total</div>
        </div>
      </div>
    </div>
  );
}
