import "server-only";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/db/admin-client";

export type TenantSession = {
  userId: string;
  companyId: string;
  role: "admin" | "support_agent";
  email: string | null | undefined;
};

/** For route handlers: returns null so you can respond 401 yourself. */
export async function getTenantSession(): Promise<TenantSession | null> {
  const u = (await auth())?.user;
  if (!u?.id || !u.companyId) return null;
  return { userId: u.id, companyId: u.companyId, role: u.role, email: u.email };
}

/** For pages and server actions: redirects to /login if signed out. */
export async function requireSession(): Promise<TenantSession> {
  const s = await getTenantSession();
  if (!s) redirect("/login");
  return s;
}

/**
 * For admin-only actions (invite users, API keys, categories, settings).
 * Re-checks the DB because a JWT can outlive a role change or deactivation.
 */
export async function requireAdmin(): Promise<TenantSession> {
  const s = await requireSession();
  const { data } = await supabaseAdmin
    .from("users")
    .select("role, is_active")
    .eq("id", s.userId)
    .eq("company_id", s.companyId)
    .maybeSingle();
  if (!data?.is_active || data.role !== "admin") redirect("/dashboard");
  return s;
}