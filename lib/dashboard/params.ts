import { z } from "zod";

export const URGENCIES = ["critical", "high", "medium", "low"] as const;
export const STATUSES = ["new", "in_progress", "resolved", "dismissed"] as const;
export const RANGES = ["7d", "30d", "90d"] as const;
export const PAGE_SIZE = 15;

const RANGE_DAYS = { "7d": 7, "30d": 30, "90d": 90 } as const;

// .catch() means bad input silently becomes the default instead of throwing
const schema = z.object({
  range: z.enum(RANGES).catch("30d"),
  urgency: z.enum(URGENCIES).optional().catch(undefined),
  status: z.enum(STATUSES).optional().catch(undefined),
  category: z.string().uuid().optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10000).catch(1),
});

export type DashboardParams = z.infer<typeof schema>;

export function parseDashboardParams(
  sp: Record<string, string | string[] | undefined>
): DashboardParams {
  // Repeated params (?urgency=a&urgency=b) arrive as arrays: take the first
  const flat = Object.fromEntries(
    Object.entries(sp).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])
  );
  return schema.parse(flat);
}

/**
 * Call this AFTER awaiting searchParams, inside a Suspense'd component:
 * Next.js 16 doesn't allow reading the current time before request data.
 */
export function rangeToDates(range: (typeof RANGES)[number]) {
  const to = new Date();
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - (RANGE_DAYS[range] - 1));
  from.setUTCHours(0, 0, 0, 0); // start of the first UTC day, so trend buckets line up
  return { from, to };
}

/** Builds a /dashboard link: keeps current filters, applies overrides, resets to page 1. */
export function buildHref(
  current: DashboardParams,
  overrides: Record<string, string | number | undefined>
) {
  const merged: Record<string, unknown> = { ...current, page: 1, ...overrides };
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(merged)) {
    if (value === undefined || value === "") continue;
    if (key === "page" && value === 1) continue;
    qs.set(key, String(value));
  }
  const s = qs.toString();
  return s ? `/dashboard?${s}` : "/dashboard";
}