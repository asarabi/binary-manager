interface Props {
  isCustom: boolean;
  retentionDays: number;
}

export default function RetentionBadge({ isCustom, retentionDays }: Props) {
  return isCustom ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gradient-to-r from-indigo-50 to-blue-50 text-indigo-600 border border-indigo-100">
      {retentionDays}d custom
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-500 border border-gray-200/60">
      {retentionDays}d default
    </span>
  );
}
