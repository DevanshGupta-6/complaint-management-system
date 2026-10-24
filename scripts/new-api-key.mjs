// Usage:
//   node scripts/new-api-key.mjs                                  -> server key (backend-to-backend)
//   node scripts/new-api-key.mjs public https://shop.example.com  -> embed-form key + allowed origin(s)
import { randomBytes, createHash } from "node:crypto";

const [mode, ...origins] = process.argv.slice(2);
const isPublic = mode === "public";
const kind = isPublic ? "public_form" : "server";
const key = (isPublic ? "cmp_live_" : "cmk_live_") + randomBytes(24).toString("base64url");
const hash = createHash("sha256").update(key).digest("hex");
const originsSql = `array[${origins.map((o) => `'${o.replace(/\/$/, "")}'`).join(", ")}]::text[]`;

console.log(`\nAPI key (shown once, store it safely):\n  ${key}\n`);
console.log("Run in the Supabase SQL Editor (change the slug for another tenant):\n");
console.log(
  `insert into api_keys (company_id, name, kind, key_prefix, key_hash, allowed_origins)\n` +
    `select id, '${isPublic ? "Website form" : "Backend key"}', '${kind}', '${key.slice(0, 12)}', '${hash}', ${originsSql}\n` +
    `from companies where slug = 'acme';\n`
);