import "server-only";
import { z } from "zod";
import { supabaseAdmin as db } from "./admin-client";

const uuid = z.string().uuid();

export type Urgency = "low" | "medium" | "high" | "critical";

export type NewComplaint = {
  apiKeyId: string;
  source: "api" | "embed_form";
  rawText: string;
  customerName?: string;
  customerEmail?: string;
  externalRef?: string;
  metadata?: Record<string, unknown>;
};

export type TriageResult = {
  relevanceScore: number;
  categoryId: string | null;
  urgencyLevel: Urgency;
  suggestedAction: string;
  model: string;
};

/** Every query is pinned to companyId, same guarantee as tenantDb(). */
export function ingestDb(companyId: string) {
  return {
    companyId,

    complaints: {
      async create(input: NewComplaint): Promise<{ id: string } | { duplicate: true }> {
        const { data, error } = await db
          .from("complaints")
          .insert({
            company_id: companyId,
            api_key_id: input.apiKeyId,
            source: input.source,
            raw_text: input.rawText,
            customer_name: input.customerName ?? null,
            customer_email: input.customerEmail ?? null,
            external_ref: input.externalRef ?? null,
            metadata: input.metadata ?? {},
          })
          .select("id")
          .single();
        // unique (company_id, external_ref): a concurrent identical request won the race
        if (error?.code === "23505") return { duplicate: true };
        if (error) throw error;
        return { id: data.id as string };
      },

      async findByExternalRef(ref: string) {
        const { data, error } = await db
          .from("complaints")
          .select("id, ai_status")
          .eq("company_id", companyId)
          .eq("external_ref", ref)
          .maybeSingle();
        if (error) throw error;
        return data as { id: string; ai_status: string } | null;
      },

      async countForKeySince(apiKeyId: string, sinceIso: string) {
        const { count, error } = await db
          .from("complaints")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyId)
          .eq("api_key_id", apiKeyId)
          .gte("created_at", sinceIso);
        if (error) throw error;
        return count ?? 0;
      },

      /**
       * Optimistic lock: bump ai_attempts only if nobody else did first.
       * Returns null when the row is done, out of attempts, or another worker won.
       */
      async claimForTriage(id: string, maxAttempts: number) {
        const complaintId = uuid.parse(id);

        const { data: row, error } = await db
          .from("complaints")
          .select("ai_attempts, ai_status")
          .eq("id", complaintId)
          .eq("company_id", companyId)
          .maybeSingle();
        if (error) throw error;
        if (!row || row.ai_status === "completed" || row.ai_attempts >= maxAttempts) return null;

        const { data: claimed, error: claimError } = await db
          .from("complaints")
          .update({ ai_attempts: row.ai_attempts + 1 })
          .eq("id", complaintId)
          .eq("company_id", companyId)
          .eq("ai_attempts", row.ai_attempts) // compare-and-swap
          .select("id, raw_text")
          .maybeSingle();
        if (claimError) throw claimError;
        return claimed as { id: string; raw_text: string } | null;
      },

      async saveTriage(id: string, t: TriageResult) {
        const { error } = await db
          .from("complaints")
          .update({
            ai_status: "completed",
            relevance_score: t.relevanceScore,
            category_id: t.categoryId, // composite FK guarantees it's this company's category
            urgency_level: t.urgencyLevel,
            suggested_action: t.suggestedAction,
            ai_model: t.model,
            ai_error: null,
            ai_processed_at: new Date().toISOString(),
          })
          .eq("id", uuid.parse(id))
          .eq("company_id", companyId)
          .neq("ai_status", "completed");
        if (error) throw error;
      },

      async markTriageFailed(id: string, message: string) {
        const { error } = await db
          .from("complaints")
          .update({ ai_status: "failed", ai_error: message.slice(0, 500) })
          .eq("id", uuid.parse(id))
          .eq("company_id", companyId)
          .neq("ai_status", "completed");
        if (error) throw error;
      },
    },

    company: {
      async getAiContext() {
        const { data, error } = await db
          .from("companies")
          .select("name, industry, company_size, ai_context")
          .eq("id", companyId)
          .single();
        if (error) throw error;
        return data as {
          name: string;
          industry: string | null;
          company_size: string | null;
          ai_context: string | null;
        };
      },
    },

    categories: {
      async listActive() {
        const { data, error } = await db
          .from("categories")
          .select("id, name, description")
          .eq("company_id", companyId)
          .eq("is_active", true)
          .order("name");
        if (error) throw error;
        return (data ?? []) as { id: string; name: string; description: string | null }[];
      },
    },
  };
}