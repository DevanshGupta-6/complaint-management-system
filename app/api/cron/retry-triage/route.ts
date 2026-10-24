import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { retryPendingTriage } from "@/lib/ai/retry";

export const maxDuration = 60;

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const given = req.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(given, `Bearer ${secret}`)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  return NextResponse.json(await retryPendingTriage(10));
}