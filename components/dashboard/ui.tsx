import type { ComplaintStatus, Urgency } from "@/lib/db/tenant";

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-gray-100 ${className}`} />;
}

const URGENCY_STYLES: Record<Urgency, string> = {
  critical: "bg-red-100 text-red-800 ring-red-200",
  high: "bg-orange-100 text-orange-800 ring-orange-200",
  medium: "bg-amber-100 text-amber-800 ring-amber-200",
  low: "bg-slate-100 text-slate-700 ring-slate-200",
};

export function UrgencyBadge({
  level,
  aiStatus,
}: {
  level: Urgency | null;
  aiStatus: "pending" | "completed" | "failed";
}) {
  if (!level) {
    return (
      <span className="text-xs text-gray-400">
        {aiStatus === "failed" ? "AI failed" : "Analyzing…"}
      </span>
    );
  }
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ring-1 ring-inset ${URGENCY_STYLES[level]}`}
    >
      {level}
    </span>
  );
}

const STATUS_LABELS: Record<ComplaintStatus, string> = {
  new: "New",
  in_progress: "In progress",
  resolved: "Resolved",
  dismissed: "Dismissed",
};

// components/dashboard/ui.tsx (replace StatusBadge)
const STATUS_STYLES: Record<ComplaintStatus, string> = {
  new: "bg-blue-50 text-blue-700 ring-blue-200",
  in_progress: "bg-purple-50 text-purple-700 ring-purple-200",
  resolved: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  dismissed: "bg-gray-100 text-gray-600 ring-gray-200",
};

export function StatusBadge({ status }: { status: ComplaintStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

export const statusLabel = (s: ComplaintStatus) => STATUS_LABELS[s];

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "danger";
}) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${tone === "danger" ? "text-red-600" : "text-gray-900"}`}>
        {value}
      </p>
      {hint && <p className="mt-0.5 text-xs text-gray-400">{hint}</p>}
    </div>
  );
}