import Link from "next/link";
import { buildHref, type DashboardParams } from "@/lib/dashboard/params";
import type { CategoryCount } from "@/lib/db/tenant";

export function CategoryBreakdown({
  data,
  params,
}: {
  data: CategoryCount[];
  params: DashboardParams;
}) {
  if (data.length === 0) {
    return <p className="py-16 text-center text-sm text-gray-500">No data yet.</p>;
  }
  const max = Math.max(...data.map((d) => d.total));

  return (
    <ul className="space-y-3">
      {data.map((d) => {
        const body = (
          <div>
            <div className="mb-1 flex justify-between text-sm">
              <span className="text-gray-800">{d.category}</span>
              <span className="text-gray-500">{d.total}</span>
            </div>
            <div className="h-2 rounded-full bg-gray-100">
              <div className="h-2 rounded-full bg-gray-800" style={{ width: `${(d.total / max) * 100}%` }} />
            </div>
          </div>
        );
        return (
          <li key={d.category_id ?? "uncategorized"}>
            {d.category_id ? (
              <Link href={buildHref(params, { category: d.category_id })} scroll={false} className="block rounded hover:bg-gray-50">
                {body}
              </Link>
            ) : (
              body
            )}
          </li>
        );
      })}
    </ul>
  );
}