interface Props {
  type: string;
}

const colors: Record<string, string> = {
  nightly: "bg-orange-100 text-orange-700",
  release: "bg-blue-100 text-blue-700",
};

export default function RetentionBadge({ type }: Props) {
  const cls = colors[type] || "bg-gray-100 text-gray-700";
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {type}
    </span>
  );
}
