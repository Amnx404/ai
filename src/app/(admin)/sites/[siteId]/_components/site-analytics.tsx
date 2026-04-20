export function SiteAnalytics({
  totalSessions,
  totalMessages,
  outOfScope,
}: {
  totalSessions: number;
  totalMessages: number;
  outOfScope: number;
}) {
  const stats = [
    { label: "Conversations", value: totalSessions },
    { label: "Messages", value: totalMessages },
    { label: "Out of scope", value: outOfScope },
  ];

  return (
    <div className="space-y-3">
      {stats.map((s) => (
        <div
          key={s.label}
          className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
        >
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            {s.label}
          </p>
          <p className="mt-1 text-3xl font-bold text-gray-900">{s.value}</p>
        </div>
      ))}
    </div>
  );
}
