import type { DefaultSession } from "next-auth";

type Role = "admin" | "support_agent";

declare module "next-auth" {
  interface User {
    companyId: string;
    role: Role;
  }
  interface Session {
    user: { id: string; companyId: string; role: Role } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    companyId: string;
    role: Role;
  }
}