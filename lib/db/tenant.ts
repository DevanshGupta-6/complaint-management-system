import "server-only";
import { cache } from "react";
import { z } from "zod";
import { supabaseAdmin as db } from "./admin-client";
import { requireSession } from "@/lib/session";

export type Urgency = "low" | "medium" | "high" | "critical";
export type ComplaintStatus = "new" | "in_progress" | "resolved" | "dismissed";

export type ComplaintFilters = {
  urgency?: Urgency;
  status?: ComplaintStatus;
  categoryId?: string;
  from?: string; // ISO timestamp, inclusive
  to?: string;   // ISO timestamp, inclusive
  page?: number;
  pageSize?: number;
};

export type ComplaintRow = {
  id: string;
  created_at: string;
  source: string;
  customer_name: string | null;
  customer_email: string | null;
  raw_text: string;
  status: ComplaintStatus;
  assigned_to: string | null;
  ai_status: "pending" | "completed" | "failed";
  relevance_score: number | null;
  urgency_level: Urgency | null;
  suggested_action: string | null;
  category_name: string | null;
};

type RawRow = Omit<ComplaintRow, "category_name"> & {
  category: { name: string } | { name: string }[] | null;
};

export type Summary = {
  total: number;
  open_count: number;
  critical_open: number;
  avg_relevance: number | null;
  ai_pending: number;
};
export type TrendPoint = {
  day: string; // YYYY-MM-DD (UTC)
  total: number;
  low: number;
  medium: number;
  high: number;
  critical: number;
};
export type CategoryCount = { category_id: string | null; category: string; total: number };

const uuid = z.string().uuid();

const COMPLAINT_COLUMNS =
  "id, created_at, source, customer_name, customer_email, raw_text, status, assigned_to, " +
  "ai_status, relevance_score, urgency_level, suggested_action, category:categories(name)";

async function rpcRows<T>(fn: string, args: Record<string, unknown>): Promise<T[]> {
  const { data, error } = await db.rpc(fn, args);
  if (error) throw error;
  return (data ?? []) as T[];
}

/**
 * Every query below is pinned to companyId inside the method body.
 * Callers cannot omit or override it.
 */
export function tenantDb(companyId: string) {
  const rangeArgs = (from: Date, to: Date) => ({
    p_company_id: companyId,
    p_from: from.toISOString(),
    p_to: to.toISOString(),
  });

  return {
    companyId,

    complaints: {
      async list(f: ComplaintFilters = {}) {
        const pageSize = Math.min(Math.max(f.pageSize ?? 25, 1), 100);
        const page = Math.max(f.page ?? 1, 1);

        let q = db
          .from("complaints")
          .select(COMPLAINT_COLUMNS, { count: "exact" })
          .eq("company_id", companyId)
          .order("created_at", { ascending: false })
          .range((page - 1) * pageSize, page * pageSize - 1);

        if (f.urgency) q = q.eq("urgency_level", f.urgency);
        if (f.status) q = q.eq("status", f.status);
        if (f.categoryId) q = q.eq("category_id", uuid.parse(f.categoryId));
        if (f.from) q = q.gte("created_at", f.from);
        if (f.to) q = q.lte("created_at", f.to);

        const { data, count, error } = await q;

        // Page number beyond the last page: PostgREST answers 416 (PGRST103)
        if (error?.code === "PGRST103") return { rows: [] as ComplaintRow[], total: 0, page, pageSize };
        if (error) throw error;

        const rows = ((data ?? []) as unknown as RawRow[]).map(({ category, ...rest }) => {
          const cat = Array.isArray(category) ? category[0] : category;
          return { ...rest, category_name: cat?.name ?? null } satisfies ComplaintRow;
        });
        return { rows, total: count ?? 0, page, pageSize };
      },

      /** Returns null when the id doesn't exist OR belongs to another tenant. */
      async get(id: string) {
        const { data, error } = await db
          .from("complaints")
          .select(COMPLAINT_COLUMNS)
          .eq("id", uuid.parse(id))
          .eq("company_id", companyId)
          .maybeSingle();
        if (error) throw error;
        return data;
      },

      /**
       * Whitelisted fields only. A cross-tenant assigned_to is rejected by the
       * composite FK (Postgres error 23503), so catch it in your server action.
       */
      async update(
        id: string,
        patch: { status?: ComplaintStatus; assigned_to?: string | null }
      ) {
        const changes: Record<string, unknown> = {};
        if (patch.status !== undefined) {
          changes.status = patch.status;
          changes.resolved_at = patch.status === "resolved" ? new Date().toISOString() : null;
        }
        if (patch.assigned_to !== undefined) changes.assigned_to = patch.assigned_to;
        if (Object.keys(changes).length === 0) return null;

        const { data, error } = await db
          .from("complaints")
          .update(changes)
          .eq("id", uuid.parse(id))
          .eq("company_id", companyId)
          .select("id")
          .maybeSingle();
        if (error) throw error;
        return data; // null => not found in this tenant
      },
    },

    metrics: {
      async summary(from: Date, to: Date): Promise<Summary> {
        const [row] = await rpcRows<Summary>("dashboard_summary", rangeArgs(from, to));
        return row ?? { total: 0, open_count: 0, critical_open: 0, avg_relevance: null, ai_pending: 0 };
      },
      trend(from: Date, to: Date) {
        return rpcRows<TrendPoint>("dashboard_trend", rangeArgs(from, to));
      },
      categories(from: Date, to: Date) {
        return rpcRows<CategoryCount>("dashboard_category_breakdown", rangeArgs(from, to));
      },
    },

    categories: {
      async list() {
        const { data, error } = await db
          .from("categories")
          .select("id, name, description")
          .eq("company_id", companyId)
          .eq("is_active", true)
          .order("name");
        if (error) throw error;
        return data ?? [];
      },
    },

    users: {
      /** Assignee dropdown. Never returns password_hash. */
      async listActive() {
        const { data, error } = await db
          .from("users")
          .select("id, name, email, role")
          .eq("company_id", companyId)
          .eq("is_active", true)
          .order("name");
        if (error) throw error;
        return data ?? [];
      },
    },
  };
}

/**
 * Standard entry point for pages and server actions.
 * React cache() dedupes it, so several Suspense sections on one page
 * share a single session lookup per request.
 */
export const getTenantDb = cache(async () => {
  const session = await requireSession();
  return { session, db: tenantDb(session.companyId) };
});