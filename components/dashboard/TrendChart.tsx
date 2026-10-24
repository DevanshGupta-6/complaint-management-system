import type { TrendPoint, Urgency } from "@/lib/db/tenant";

// Bottom-to-top stacking order
const STACK: { key: Urgency; color: string }[] = [
  { key: "low", color: "bg-slate-300" },
  { key: "medium", color: "bg-amber-400" },
  { key: "high", color: "bg-orange-500" },
  { key: "critical", color: "bg-red-600" },
];

export function TrendChart({ data }: { data: TrendPoint[] }) {
  const max = Math.max(...data.map((d) => d.total), 0);
  if (max === 0) {
    return <p className="py-16 text-center text-sm text-gray-500">No complaints in this period.</p>;
  }

  return (
    <div>
      <div className="flex h-44 items-end gap-0.5">
        {data.map((d) => (
          <div
            key={d.day}
            className="flex h-full flex-1 flex-col-reverse"
            title={`${d.day}: ${d.total} complaint${d.total === 1 ? "" : "s"} (${d.critical} critical, ${d.high} high)`}
          >
            {STACK.map(({ key, color }) =>
              d[key] > 0 ? (
                <div key={key} className={color} style={{ height: `${(d[key] / max) * 100}%` }} />
              ) : null
            )}
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-xs text-gray-400">
        <span>{data[0].day}</span>
        <span>{data[data.length - 1].day}</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-600">
        {[...STACK].reverse().map(({ key, color }) => (
          <span key={key} className="inline-flex items-center gap-1.5 capitalize">
            <span className={`h-2.5 w-2.5 rounded-sm ${color}`} />
            {key}
          </span>
        ))}
      </div>
    </div>
  );
}