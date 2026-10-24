import type { NextAuthConfig } from "next-auth";

export default {
  providers: [], // real providers live in auth.ts (they need Node APIs)
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 }, // 8h: bounds how long a stale role can live
  pages: { signIn: "/login" },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const loggedIn = !!auth?.user;
      const path = nextUrl.pathname;
      if (path.startsWith("/dashboard")) return loggedIn; // false -> redirect to /login
      if (path === "/login" && loggedIn) {
        return Response.redirect(new URL("/dashboard", nextUrl));
      }
      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id!;
        token.companyId = user.companyId;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id;
      session.user.companyId = token.companyId;
      session.user.role = token.role;
      return session;
    },
  },
} satisfies NextAuthConfig;