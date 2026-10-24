import Link from "next/link";
import {
  buildHref,
  RANGES,
  STATUSES,
  URGENCIES,
  type DashboardParams,
} from "@/lib/dashboard/params";

type Option = { label: string; value: string | undefined };

function Row({
  label,
  param,
  options,
  params,
}: {
  label: string;
  param: "range" | "urgency" | "status" | "category";
  options: Option[];
  params: DashboardParams;
}) {
  const active = params[param];
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-20 text-xs font-medium uppercase tracking-wide text-gray-500">{label}</span>
      {options.map((o) => (
        <Link
          key={o.label}
          href={buildHref(params, { [param]: o.value })}
          scroll={false}
          className={`rounded-full border px-3 py-1 text-xs capitalize transition-colors ${
            o.value === active
              ? "border-gray-900 bg-gray-900 text-white"
              : "bg-white text-gray-700 hover:bg-gray-50"
          }`}
        >
          {o.label}
        </Link>
      ))}
    </div>
  );
}

const humanize = (s: string) => s.replace("_", " ");

export function FilterBar({
  params,
  categories,
}: {
  params: DashboardParams;
  categories: { id: string; name: string }[];
}) {
  return (
    <div className="space-y-2 rounded-xl border bg-white p-4">
      <Row
        label="Period"
        param="range"
        params={params}
        options={RANGES.map((r) => ({ label: `Last ${r.replace("d", " days")}`, value: r }))}
      />
      <Row
        label="Urgency"
        param="urgency"
        params={params}
        options={[{ label: "All", value: undefined }, ...URGENCIES.map((u) => ({ label: u, value: u }))]}
      />
      <Row
        label="Status"
        param="status"
        params={params}
        options={[{ label: "All", value: undefined }, ...STATUSES.map((s) => ({ label: humanize(s), value: s }))]}
      />
      <Row
        label="Category"
        param="category"
        params={params}
        options={[{ label: "All", value: undefined }, ...categories.map((c) => ({ label: c.name, value: c.id }))]}
      />
    </div>
  );
}