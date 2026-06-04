// POST or GET /api/cron/daily — entry point for the cron service.
//
// Auth: secret in either ?secret=... or `Authorization: Bearer <CRON_SECRET>`.
// Set CRON_SECRET in env and configure your cron runner (Vercel Cron,
// EasyCron, GitHub Actions, etc.) to call this once a day.

import { NextRequest, NextResponse } from "next/server";
import { runDailyJobs } from "@/lib/cron-jobs";

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // never expose without a secret set
  const url = new URL(req.url);
  const qs = url.searchParams.get("secret");
  if (qs && qs === secret) return true;
  const auth = req.headers.get("authorization");
  if (auth) {
    const m = /^Bearer\s+(.+)$/i.exec(auth.trim());
    if (m && m[1] === secret) return true;
  }
  return false;
}

async function handle(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await runDailyJobs("cron");
  return NextResponse.json(result);
}

export async function GET(req: NextRequest) {
  return handle(req);
}
export async function POST(req: NextRequest) {
  return handle(req);
}
