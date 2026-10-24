import "server-only";
import { createHash } from "node:crypto";
import { supabaseAdmin } from "@/lib/db/admin-client";

export type IngestKey = {
  id: string;
  companyId: string;
  kind: "server" | "public_form";
  allowedOrigins: string[];
  lastUsedAt: string | null;
};

function extractKey(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim() || null;
  return req.headers.get("x-api-key")?.trim() || null;
}

/** Pre-tenant lookup: this is where companyId is derived from the credential. */
export async function authenticateIngestKey(req: Request): Promise<IngestKey | null> {
  const raw = extractKey(req);
  if (!raw || raw.length < 20 || raw.length > 200) return null;

  const hash = createHash("sha256").update(raw).digest("hex");
  const { data, error } = await supabaseAdmin
    .from("api_keys")
    .select("id, company_id, kind, allowed_origins, last_used_at, companies!inner(is_active)")
    .eq("key_hash", hash)
    .is("revoked_at", null)
    .maybeSingle();

  if (error) {
    console.error("[ingest] key lookup failed:", error.message);
    return null;
  }
  if (!data) return null;

  const company = Array.isArray(data.companies) ? data.companies[0] : data.companies;
  if (!company?.is_active) return null;

  return {
    id: data.id,
    companyId: data.company_id,
    kind: data.kind,
    allowedOrigins: data.allowed_origins ?? [],
    lastUsedAt: data.last_used_at,
  };
}

/** Best-effort, at most once a minute per key. */
export async function touchKey(key: IngestKey) {
  if (key.lastUsedAt && Date.now() - new Date(key.lastUsedAt).getTime() < 60_000) return;
  await supabaseAdmin
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", key.id)
    .eq("company_id", key.companyId);
}