// app/track/page.tsx
import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { lookupCustomerComplaints, type PublicTrackedComplaint } from "@/lib/db/track-db";
import { formatIST } from "@/lib/date";
import { StatusBadge } from "@/components/dashboard/ui";

export const metadata: Metadata = {
  title: "Track Your Complaint",
  robots: { index: false, follow: false },
};

type SearchParams = Promise<{ id?: string; email?: string }>;

const STEPS = [
  { key: "new", label: "Received" },
  { key: "in_progress", label: "In Review" },
  { key: "resolved", label: "Resolved" },
] as const;

function StatusTimeline({ status }: { status: PublicTrackedComplaint["status"] }) {
  if (status === "dismissed") {
    return (
      <div className="mt-3 rounded-lg bg-gray-100 px-3 py-2 text-xs text-gray-600">
        This complaint was closed / dismissed by the support team.
      </div>
    );
  }
  const activeIdx = status === "new" ? 0 : status === "in_progress" ? 1 : 2;
  return (
    <div className="mt-4 grid grid-cols-3 gap-2">
      {STEPS.map((step, idx) => {
        const done = idx <= activeIdx;
        return (
          <div key={step.key} className="space-y-1">
            <div
              className={`h-1.5 rounded-full ${
                done ? "bg-emerald-600" : "bg-gray-200"
              }`}
            />
            <p className={`text-xs ${done ? "font-medium text-gray-900" : "text-gray-400"}`}>
              {step.label}
            </p>
          </div>
        );
      })}
    </div>
  );
}

async function TrackResults({ searchParams }: { searchParams: SearchParams }) {
  const { id, email } = await searchParams;
  if (!id) return null;

  const result = await lookupCustomerComplaints({ id, email });

  if (result.error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {result.error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-medium text-gray-700">
        {result.mode === "email_list"
          ? `Showing ${result.complaints.length} complaint(s) for ${email}`
          : "Complaint Status"}
      </h2>

      {result.complaints.map((c) => (
        <article key={c.id} className="rounded-xl border bg-white p-5 shadow-xs space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-xs text-gray-500">
                {c.company_name} · Tracking ID:{" "}
                <span className="font-mono text-gray-800">{c.id}</span>
              </p>
              <p className="mt-0.5 text-xs text-gray-500">
                Submitted: {formatIST(c.created_at)} IST
                {c.resolved_at && ` · Resolved: ${formatIST(c.resolved_at)} IST`}
              </p>
            </div>
            <StatusBadge status={c.status} />
          </div>

          <p className="whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-sm text-gray-800">
            {c.raw_text}
          </p>

          {c.category_name && (
            <p className="text-xs text-gray-500">
              Assigned Category: <span className="font-medium text-gray-700">{c.category_name}</span>
            </p>
          )}

          <StatusTimeline status={c.status} />
        </article>
      ))}
    </div>
  );
}

async function SearchForm({ searchParams }: { searchParams: SearchParams }) {
  const { id = "", email = "" } = await searchParams;
  return (
    <form action="/track" method="GET" className="rounded-2xl border bg-white p-6 shadow-xs space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Track your complaints</h1>
        <p className="mt-1 text-sm text-gray-600">
          Enter your Tracking ID to check a single complaint, or include your email address to view
          all complaints associated with your email.
        </p>
      </div>

      <label className="block text-sm font-medium text-gray-800">
        Complaint Tracking ID <span className="text-red-500">*</span>
        <input
          name="id"
          required
          defaultValue={id}
          placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
          className="mt-1 w-full rounded-lg border px-3 py-2 font-mono text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
        />
      </label>

      <label className="block text-sm font-medium text-gray-800">
        Your Email <span className="font-normal text-gray-400">(optional — to view all your complaints)</span>
        <input
          name="email"
          type="email"
          defaultValue={email}
          placeholder="you@example.com"
          className="mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
        />
      </label>

      <button
        type="submit"
        className="w-full rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800"
      >
        Track Status
      </button>
    </form>
  );
}

export default function TrackPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="min-h-screen bg-gray-50 px-4 py-12">
      <div className="mx-auto max-w-2xl space-y-6">
        <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-gray-200" />}>
          <SearchForm searchParams={searchParams} />
        </Suspense>
        <Suspense fallback={<div className="h-40 animate-pulse rounded-xl bg-gray-200" />}>
          <TrackResults searchParams={searchParams} />
        </Suspense>
        <p className="text-center text-xs text-gray-400">
          <Link href="/" className="hover:underline">
            Back to home
          </Link>
        </p>
      </div>
    </main>
  );
}