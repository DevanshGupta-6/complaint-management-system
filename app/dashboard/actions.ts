// app/dashboard/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getTenantDb, type ComplaintStatus } from "@/lib/db/tenant";
import { STATUSES } from "@/lib/dashboard/params";

const updateStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(STATUSES),
});

export async function updateComplaintStatusAction(formData: FormData) {
  const { session, db } = await getTenantDb();

  // Optional: uncomment the next line if ONLY 'admin' (and not 'support_agent') can resolve
  // if (session.role !== "admin") throw new Error("Forbidden");

  const parsed = updateStatusSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
  });
  if (!parsed.success) return;

  await db.complaints.update(parsed.data.id, {
    status: parsed.data.status as ComplaintStatus,
  });

  revalidatePath("/dashboard");
}