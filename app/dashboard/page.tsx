import { Suspense } from "react";
import { redirect } from "next/navigation";
import { signOut } from "@/auth";
import { getTenantDb } from "@/lib/db/tenant";
import {
  buildHref,
  PAGE_SIZE,
  parseDashboardParams,
  rangeToDates,
} from "@/lib/dashboard/params";
import { Skeleton, StatCard } from "@/components/dashboard/ui";
import { FilterBar } from "@/components/dashboard/FilterBar";
import { TrendChart } from "@/components/dashboard/TrendChart";
import { CategoryBreakdown } from "@/components/dashboard/CategoryBreakdown";
import { ComplaintsTable } from "@/components/dashboard/ComplaintsTable";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function Header() {
  const { session } = await getTenantDb();
  return (
    <header className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-semibold">Complaints</h1>
        <p className="text-sm text-gray-500">
          {session.email} · {session.role === "admin" ? "Admin" : "Support agent"}
        </p>
      </div>
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/login" });
        }}
      >
        <button className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50">Sign out</button>
      </form>
    </header>
  );
}

async function Filters({ searchParams }: { searchParams: SearchParams }) {
  const params = parseDashboardParams(await searchParams);
  const { db } = await getTenantDb();
  const categories = await db.categories.list();
  return <FilterBar params={params} categories={categories} />;
}

async function Stats({ searchParams }: { searchParams: SearchParams }) {
  const params = parseDashboardParams(await searchParams);
  const { db } = await getTenantDb();
  const { from, to } = rangeToDates(params.range);
  const s = await db.metrics.summary(from, to);

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
      <StatCard label="Complaints" value={s.total} hint={`Last ${params.range.replace("d", " days")}`} />
      <StatCard label="Open" value={s.open_count} hint="New + in progress" />
      <StatCard label="Critical & open" value={s.critical_open} tone={s.critical_open > 0 ? "danger" : "default"} />
      <StatCard label="Avg relevance" value={s.avg_relevance ?? "-"} hint="1 to 10" />
      <StatCard label="AI pending" value={s.ai_pending} hint="Not yet triaged" />
    </div>
  );
}

async function Trend({ searchParams }: { searchParams: SearchParams }) {
  const params = parseDashboardParams(await searchParams);
  const { db } = await getTenantDb();
  const { from, to } = rangeToDates(params.range);
  const data = await db.metrics.trend(from, to);
  return (
    <section className="rounded-xl border bg-white p-4 lg:col-span-2">
      <h2 className="mb-3 text-sm font-medium text-gray-900">Complaints per day</h2>
      <TrendChart data={data} />
    </section>
  );
}

async function Categories({ searchParams }: { searchParams: SearchParams }) {
  const params = parseDashboardParams(await searchParams);
  const { db } = await getTenantDb();
  const { from, to } = rangeToDates(params.range);
  const data = await db.metrics.categories(from, to);
  return (
    <section className="rounded-xl border bg-white p-4">
      <h2 className="mb-3 text-sm font-medium text-gray-900">By category</h2>
      <CategoryBreakdown data={data} params={params} />
    </section>
  );
}

async function ComplaintsSection({ searchParams }: { searchParams: SearchParams }) {
  const params = parseDashboardParams(await searchParams);
  const { db } = await getTenantDb();
  const { from, to } = rangeToDates(params.range);

  const result = await db.complaints.list({
    urgency: params.urgency,
    status: params.status,
    categoryId: params.category,
    from: from.toISOString(),
    to: to.toISOString(),
    page: params.page,
    pageSize: PAGE_SIZE,
  });

  // e.g. a bookmarked ?page=9 after the data shrank
  if (result.rows.length === 0 && params.page > 1) redirect(buildHref(params, { page: 1 }));

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium text-gray-900">
        Complaints <span className="font-normal text-gray-500">({result.total})</span>
      </h2>
      <ComplaintsTable
        rows={result.rows}
        total={result.total}
        page={result.page}
        pageSize={result.pageSize}
        params={params}
      />
    </section>
  );
}

export default function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="mx-auto max-w-7xl space-y-6 p-6">
      <Suspense fallback={<Skeleton className="h-12" />}>
        <Header />
      </Suspense>
      <Suspense fallback={<Skeleton className="h-36" />}>
        <Filters searchParams={searchParams} />
      </Suspense>
      <Suspense fallback={<Skeleton className="h-24" />}>
        <Stats searchParams={searchParams} />
      </Suspense>
      <div className="grid gap-6 lg:grid-cols-3">
        <Suspense fallback={<Skeleton className="h-72 lg:col-span-2" />}>
          <Trend searchParams={searchParams} />
        </Suspense>
        <Suspense fallback={<Skeleton className="h-72" />}>
          <Categories searchParams={searchParams} />
        </Suspense>
      </div>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <ComplaintsSection searchParams={searchParams} />
      </Suspense>
    </main>
  );
}