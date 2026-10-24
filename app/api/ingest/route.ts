import { after, NextResponse } from "next/server";
import { authenticateIngestKey, touchKey } from "@/lib/ingest/api-key";
import { ingestSchema } from "@/lib/ingest/schema";
import { ingestDb } from "@/lib/db/ingest-db";
import { processComplaint } from "@/lib/ai/process";

export const maxDuration = 60; // the after() triage must finish inside this on serverless hosts

const MAX_BODY_BYTES = 32 * 1024;
const RATE_LIMIT_PER_MIN = { server: 120, public_form: 10 } as const;

// Browsers send a preflight without credentials, so the key's allow-list can't be checked yet.
// It is enforced on the real POST: an unlisted origin gets a 403 with no CORS headers.
export function OPTIONS(req: Request) {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": req.headers.get("origin") ?? "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "content-type, x-api-key, authorization",
      "Access-Control-Max-Age": "86400",
      Vary: "Origin",
    },
  });
}

export async function POST(req: Request) {
  try {
    return await handle(req);
  } catch (err) {
    console.error("[ingest] unhandled error:", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

async function handle(req: Request) {
  const key = await authenticateIngestKey(req);
  if (!key) return NextResponse.json({ error: "invalid_api_key" }, { status: 401 });

  // Public form keys are visible in page source, so they only work from allow-listed origins.
  // Server keys get no CORS headers, so using one from a browser fails loudly by design.
  const origin = req.headers.get("origin");
  let cors: Record<string, string> = {};
  if (key.kind === "public_form") {
    if (!origin || !key.allowedOrigins.includes(origin)) {
      return NextResponse.json({ error: "origin_not_allowed" }, { status: 403 });
    }
    cors = { "Access-Control-Allow-Origin": origin, Vary: "Origin" };
  }
  const reply = (body: unknown, status: number, headers: Record<string, string> = {}) =>
    NextResponse.json(body, { status, headers: { ...cors, ...headers } });

  // Body: size cap, then JSON, then schema
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
    return reply({ error: "payload_too_large" }, 413);
  }
  const text = await req.text();
  if (Buffer.byteLength(text) > MAX_BODY_BYTES) return reply({ error: "payload_too_large" }, 413);

  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    return reply({ error: "invalid_json" }, 400);
  }

  const parsed = ingestSchema.safeParse(payload);
  if (!parsed.success) {
    return reply(
      {
        error: "validation_failed",
        issues: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
      },
      422
    );
  }
  const body = parsed.data;
  const db = ingestDb(key.companyId); // from here on, everything is pinned to the key's company

  // Per-key rate limit. Protects your Gemini bill from a leaked or abused key
  const recent = await db.complaints.countForKeySince(key.id, new Date(Date.now() - 60_000).toISOString());
  if (recent >= RATE_LIMIT_PER_MIN[key.kind]) {
    return reply({ error: "rate_limited" }, 429, { "Retry-After": "30" });
  }

  // Idempotency: retried requests with the same external_ref return the original
  if (body.external_ref) {
    const existing = await db.complaints.findByExternalRef(body.external_ref);
    if (existing) return reply({ id: existing.id, status: existing.ai_status, duplicate: true }, 200);
  }

  const created = await db.complaints.create({
    apiKeyId: key.id,
    source: key.kind === "public_form" ? "embed_form" : "api",
    rawText: body.raw_text,
    customerName: body.customer_name,
    customerEmail: body.customer_email,
    externalRef: body.external_ref,
    metadata: body.metadata,
  });

  if ("duplicate" in created) {
    // Lost a race with an identical concurrent request
    const existing = body.external_ref ? await db.complaints.findByExternalRef(body.external_ref) : null;
    return reply({ id: existing?.id ?? null, status: existing?.ai_status ?? "pending", duplicate: true }, 200);
  }

  // Respond now; triage runs after the response is sent
  after(async () => {
    await processComplaint(key.companyId, created.id);
    await touchKey(key).catch(() => {});
  });

  return reply({ id: created.id, status: "pending" }, 202);
}