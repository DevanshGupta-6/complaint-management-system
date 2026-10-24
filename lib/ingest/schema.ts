import { z } from "zod";

// Postgres text/jsonb cannot store NUL characters; one in a payload would 500 the insert
const stripNul = (s: string) => s.replace(/\u0000/g, "");

const optionalText = (max: number) =>
  z
    .string()
    .max(max)
    .transform((s) => stripNul(s).trim() || undefined)
    .optional();

// HTML forms send "" for blank fields
const optionalEmail = z
  .union([z.literal(""), z.email().max(254)])
  .optional()
  .transform((v) => v || undefined);

export const ingestSchema = z.object({
  raw_text: z
    .string()
    .max(10_000)
    .transform((s) => stripNul(s).trim())
    .refine((s) => s.length > 0, "raw_text is required"),
  customer_name: optionalText(200),
  customer_email: optionalEmail,
  external_ref: optionalText(200),
  metadata: z
    .record(z.string(), z.unknown())
    .refine((m) => JSON.stringify(m).length <= 4_000, "metadata must be under 4 KB")
    .transform((m) => JSON.parse(JSON.stringify(m).replaceAll("\\u0000", "")) as Record<string, unknown>)
    .optional(),
});

export type IngestBody = z.infer<typeof ingestSchema>;