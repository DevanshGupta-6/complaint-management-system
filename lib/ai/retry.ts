import "server-only";
import { supabaseAdmin } from "@/lib/db/admin-client";
import { MAX_TRIAGE_ATTEMPTS, processComplaint } from "./process";

export async function retryPendingTriage(limit = 10) {
  // updated_at changes on every claim, so a row a live worker just took is left alone
  const staleBefore = new Date(Date.now() - 2 * 60_000).toISOString();

  const { data, error } = await supabaseAdmin
    .from("complaints")
    .select("id, company_id")
    .in("ai_status", ["pending", "failed"])
    .lt("ai_attempts", MAX_TRIAGE_ATTEMPTS)
    .lt("updated_at", staleBefore)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw error;

  const results = { completed: 0, failed: 0, skipped: 0 };
  for (const row of data ?? []) {
    results[await processComplaint(row.company_id, row.id)]++;
  }
  return { picked: data?.length ?? 0, ...results };
}