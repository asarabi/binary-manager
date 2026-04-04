interface Props {
  isCustom: boolean;
  retentionDays: number;
}

export default function RetentionBadge({ isCustom, retentionDays }: Props) {
  return isCustom ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-blue-50 text-blue-600 border border-blue-100">
      {retentionDays}d custom
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-gray-50 text-gray-500 border border-gray-100">
      {retentionDays}d default
    </span>
  );
}
