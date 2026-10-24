import NextAuth from "next-auth";
import authConfig from "./auth.config";

export const { auth: proxy } = NextAuth(authConfig);
const {auth} = NextAuth(authConfig)

export default auth;

export const config = {
  // Skips /api so /api/auth/* and Phase 3's /api/ingest (API-key auth) aren't session-gated
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};