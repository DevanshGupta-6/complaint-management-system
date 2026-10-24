import "server-only";
import { createClient } from "@supabase/supabase-js";

// Service-role client: bypasses RLS. Import ONLY from lib/, auth.ts, or
// Phase 3's ingestion handler. App code must go through getTenantDb().
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);