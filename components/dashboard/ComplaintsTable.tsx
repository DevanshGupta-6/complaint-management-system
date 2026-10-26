// components/dashboard/ComplaintsTable.tsx
import Link from "next/link";
import { buildHref, STATUSES, type DashboardParams } from "@/lib/dashboard/params";
import type { ComplaintRow } from "@/lib/db/tenant";
import { formatIST } from "@/lib/date";
import { updateComplaintStatusAction } from "@/app/dashboard/actions";
import { StatusBadge, statusLabel, UrgencyBadge } from "./ui";

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
        <table className="w-full table-fixed divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
            <tr>
              <th className="w-28 px-3 py-3">Received (IST)</th>
              <th className="w-40 px-3 py-3">Customer</th>
              <th className="w-1/3 px-3 py-3">Complaint</th>
              <th className="w-28 px-3 py-3">Category</th>
              <th className="w-28 px-3 py-3">Urgency / Score</th>
              <th className="w-56 px-3 py-3">Suggested action</th>
              <th className="w-40 px-3 py-3">Status & Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((r) => (
              <tr key={r.id} className="align-top hover:bg-gray-50">
                <td className="px-3 py-3 text-xs text-gray-600">
                  {formatIST(r.created_at)}
                </td>
                <td className="px-3 py-3 break-words">
                  <div className="font-medium text-gray-900">{r.customer_name ?? "-"}</div>
                  <div className="text-xs text-gray-500 break-all">{r.customer_email}</div>
                </td>
                {/* Full complaint text wraps vertically instead of clamping to 2 lines */}
                <td className="px-3 py-3 text-gray-800">
                  <p className="whitespace-pre-wrap break-words">{r.raw_text}</p>
                </td>
                <td className="px-3 py-3 text-xs text-gray-700 break-words">
                  {r.category_name ?? "-"}
                </td>
                <td className="px-3 py-3 space-y-1">
                  <div>
                    <UrgencyBadge level={r.urgency_level} aiStatus={r.ai_status} />
                  </div>
                  <div className="text-xs tabular-nums text-gray-500">
                    Score: <span className="font-medium text-gray-700">{r.relevance_score ?? "-"}</span>/10
                  </div>
                </td>
                {/* Full suggested action is always visible and wraps cleanly */}
                <td className="px-3 py-3 text-xs text-gray-600">
                  <p className="whitespace-pre-wrap break-words">{r.suggested_action ?? "-"}</p>
                </td>
                <td className="px-3 py-3 space-y-2">
                  <div>
                    <StatusBadge status={r.status} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {r.status !== "resolved" && (
                      <form action={updateComplaintStatusAction}>
                        <input type="hidden" name="id" value={r.id} />
                        <input type="hidden" name="status" value="resolved" />
                        <button
                          type="submit"
                          className="w-full rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700"
                        >
                          Mark Resolved
                        </button>
                      </form>
                    )}
                    <form action={updateComplaintStatusAction} className="flex gap-1">
                      <input type="hidden" name="id" value={r.id} />
                      <select
                        name="status"
                        defaultValue={r.status}
                        aria-label="Change complaint status"
                        className="min-w-0 flex-1 rounded-md border bg-white px-1.5 py-1 text-xs text-gray-700"
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {statusLabel(s)}
                          </option>
                        ))}
                      </select>
                      <button
                        type="submit"
                        className="rounded-md border px-2 py-1 text-xs text-gray-700 hover:bg-gray-100"
                      >
                        Save
                      </button>
                    </form>
                  </div>
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
            <Link
              href={buildHref(params, { page: page - 1 })}
              scroll={false}
              className={`${btn} bg-white hover:bg-gray-50`}
            >
              Previous
            </Link>
          ) : (
            <span className={`${btn} text-gray-300`}>Previous</span>
          )}
          {page < pages ? (
            <Link
              href={buildHref(params, { page: page + 1 })}
              scroll={false}
              className={`${btn} bg-white hover:bg-gray-50`}
            >
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