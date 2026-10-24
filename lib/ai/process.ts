import "server-only";
import { ingestDb } from "@/lib/db/ingest-db";
import { TRIAGE_MODEL, triageComplaint } from "./triage";

export const MAX_TRIAGE_ATTEMPTS = 3;

/** Safe to call from anywhere, any number of times: it claims, runs, and records the outcome. */
export async function processComplaint(companyId: string, complaintId: string) {
  const db = ingestDb(companyId);
  try {
    const claimed = await db.complaints.claimForTriage(complaintId, MAX_TRIAGE_ATTEMPTS);
    if (!claimed) return "skipped" as const;

    try {
      const [company, categories] = await Promise.all([
        db.company.getAiContext(),
        db.categories.listActive(),
      ]);

      const result = await triageComplaint({ rawText: claimed.raw_text, company, categories });
      const category = categories.find((c) => c.name === result.category) ?? null;

      await db.complaints.saveTriage(complaintId, {
        relevanceScore: result.relevance_score,
        categoryId: category?.id ?? null,
        urgencyLevel: result.urgency_level,
        suggestedAction: result.suggested_action,
        model: TRIAGE_MODEL,
      });
      return "completed" as const;
    } catch (err) {
      await db.complaints.markTriageFailed(
        complaintId,
        err instanceof Error ? err.message : String(err)
      );
      return "failed" as const;
    }
  } catch (err) {
    // Infrastructure error (DB unreachable, etc.). Log ids only, never complaint text (PII)
    console.error("[triage] unexpected error for", complaintId, err);
    return "failed" as const;
  }
}