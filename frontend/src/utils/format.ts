export function formatBytes(bytes: number, zeroLabel = "0 B"): string {
  if (bytes === 0) return zeroLabel;
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}
