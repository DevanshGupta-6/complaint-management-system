import Link from "next/link";
import { buildHref, type DashboardParams } from "@/lib/dashboard/params";
import type { ComplaintRow } from "@/lib/db/tenant";
import { StatusBadge, UrgencyBadge } from "./ui";

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

export function ComplaintsTable({
  rows,
  total,
  page,
  pageSize,
  params,
}: {
  rows: ComplaintRow[];
  total: number;
  page: number;
  pageSize: number;
  params: DashboardParams;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-white p-10 text-center text-sm text-gray-500">
        No complaints match these filters.
      </div>
    );
  }

  const pages = Math.max(1, Math.ceil(total / pageSize));
  const btn = "rounded-md border px-3 py-1.5 text-xs";

  return (
    <div className="overflow-hidden rounded-xl border bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Received (UTC)</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Complaint</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Urgency</th>
              <th className="px-4 py-3 text-right">Relevance</th>
              <th className="px-4 py-3">Status</th>
              <th className="hidden px-4 py-3 xl:table-cell">Suggested action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((r) => (
              <tr key={r.id} className="align-top hover:bg-gray-50">
                <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                  {dateFmt.format(new Date(r.created_at))}
                </td>
                <td className="px-4 py-3">
                  <div className="text-gray-900">{r.customer_name ?? "-"}</div>
                  <div className="text-xs text-gray-500">{r.customer_email}</div>
                </td>
                {/* React escapes text, so raw complaint content can't inject markup */}
                <td className="max-w-sm px-4 py-3 text-gray-800">
                  <p className="line-clamp-2">{r.raw_text}</p>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-gray-700">{r.category_name ?? "-"}</td>
                <td className="px-4 py-3">
                  <UrgencyBadge level={r.urgency_level} aiStatus={r.ai_status} />
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                  {r.relevance_score ?? "-"}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <StatusBadge status={r.status} />
                </td>
                <td className="hidden max-w-xs px-4 py-3 text-xs text-gray-600 xl:table-cell">
                  <p className="line-clamp-2">{r.suggested_action ?? "-"}</p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t bg-gray-50 px-4 py-3 text-xs text-gray-600">
        <span>
          Page {page} of {pages} · {total} complaints
        </span>
        <div className="flex gap-2">
          {page > 1 ? (
            <Link href={buildHref(params, { page: page - 1 })} scroll={false} className={`${btn} bg-white hover:bg-gray-50`}>
              Previous
            </Link>
          ) : (
            <span className={`${btn} text-gray-300`}>Previous</span>
          )}
          {page < pages ? (
            <Link href={buildHref(params, { page: page + 1 })} scroll={false} className={`${btn} bg-white hover:bg-gray-50`}>
              Next
            </Link>
          ) : (
            <span className={`${btn} text-gray-300`}>Next</span>
          )}
        </div>
      </div>
    </div>
  );
}