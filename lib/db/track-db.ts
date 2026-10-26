// lib/db/track-db.ts
import "server-only";
import { z } from "zod";
import { supabaseAdmin as db } from "./admin-client";
import type { ComplaintStatus } from "./tenant";

const uuidSchema = z.string().uuid();
const emailSchema = z.string().email().max(254);

export type PublicTrackedComplaint = {
  id: string;
  created_at: string;
  resolved_at: string | null;
  status: ComplaintStatus;
  raw_text: string;
  category_name: string | null;
  company_name: string;
};

type RawPublicRow = {
  id: string;
  created_at: string;
  resolved_at: string | null;
  status: ComplaintStatus;
  raw_text: string;
  customer_email: string | null;
  category: { name: string } | { name: string }[] | null;
  company: { name: string } | { name: string }[] | null;
};

const PUBLIC_COLUMNS =
  "id, created_at, resolved_at, status, raw_text, customer_email, " +
  "category:categories(name), company:companies(name)";

function mapPublicRow(row: RawPublicRow): PublicTrackedComplaint {
  const cat = Array.isArray(row.category) ? row.category[0] : row.category;
  const comp = Array.isArray(row.company) ? row.company[0] : row.company;
  return {
    id: row.id,
    created_at: row.created_at,
    resolved_at: row.resolved_at ?? null,
    status: row.status,
    raw_text: row.raw_text,
    category_name: cat?.name ?? null,
    company_name: comp?.name ?? "Company",
  };
}

/**
 * 1) If only `id` is provided: returns that single complaint.
 * 2) If `email` AND `id` are provided: verifies that `id` belongs to `email`,
 *    then returns ALL complaints submitted by `email` (newest first).
 */
export async function lookupCustomerComplaints(input: {
  id?: string;
  email?: string;
}): Promise<{
  mode: "single" | "email_list" | "invalid";
  complaints: PublicTrackedComplaint[];
  error?: string;
}> {
  const parsedId = uuidSchema.safeParse(input.id?.trim());
  const rawEmail = input.email?.trim().toLowerCase();

  if (!parsedId.success) {
    return {
      mode: "invalid",
      complaints: [],
      error: "Please enter a valid Complaint Tracking ID.",
    };
  }

  // Fetch the anchor complaint by its UUID
  const { data: anchor, error: anchorErr } = await db
    .from("complaints")
    .select(PUBLIC_COLUMNS)
    .eq("id", parsedId.data)
    .maybeSingle();

  if (anchorErr) throw anchorErr;
  if (!anchor) {
    return {
      mode: "invalid",
      complaints: [],
      error: "No complaint found with that Tracking ID.",
    };
  }

  const typedAnchor = anchor as unknown as RawPublicRow;

  // If the user also provided an email, verify ownership and list all their complaints
  if (rawEmail) {
    const parsedEmail = emailSchema.safeParse(rawEmail);
    if (!parsedEmail.success) {
      return {
        mode: "invalid",
        complaints: [],
        error: "Please enter a valid email address.",
      };
    }

    if ((typedAnchor.customer_email ?? "").toLowerCase() !== parsedEmail.data) {
      return {
        mode: "invalid",
        complaints: [],
        error: "That Tracking ID does not match the email address provided.",
      };
    }

    const { data: allRows, error: listErr } = await db
      .from("complaints")
      .select(PUBLIC_COLUMNS)
      .ilike("customer_email", parsedEmail.data)
      .order("created_at", { ascending: false })
      .limit(50);

    if (listErr) throw listErr;
    return {
      mode: "email_list",
      complaints: ((allRows ?? []) as unknown as RawPublicRow[]).map(mapPublicRow),
    };
  }

  return {
    mode: "single",
    complaints: [mapPublicRow(typedAnchor)],
  };
}