import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import authConfig from "./auth.config";
import { supabaseAdmin } from "@/lib/db/admin-client";

const credentialsSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(200),
});

// Compared against when the email doesn't exist, so response time doesn't
// reveal which emails are registered.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 12);

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        const { data: u, error } = await supabaseAdmin
          .from("users")
          .select("id, email, name, password_hash, role, is_active, company_id, companies!inner(is_active)")
          .eq("email", email)
          .maybeSingle();
        if (error) console.error("[auth] user lookup failed", error.message);

        const passwordOk = await bcrypt.compare(password, u?.password_hash ?? DUMMY_HASH);
        const company = Array.isArray(u?.companies) ? u.companies[0] : u?.companies;

        if (!u || !passwordOk || !u.is_active || !company?.is_active) return null;

        await supabaseAdmin
          .from("users")
          .update({ last_login_at: new Date().toISOString() })
          .eq("id", u.id);

        return {
          id: u.id,
          email: u.email,
          name: u.name,
          companyId: u.company_id,
          role: u.role,
        };
      },
    }),
  ],
});