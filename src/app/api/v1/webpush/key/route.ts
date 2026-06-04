// GET /api/v1/webpush/key
// Public-readable VAPID application server key. The browser needs
// this to call pushManager.subscribe({ applicationServerKey: ... }).
//
// Returns {} when web push isn't configured so the client can show a
// graceful "notifications unavailable" state.

import { NextResponse } from "next/server";
import { vapidPublicKey, webPushConfigured } from "@/lib/webpush";

export async function GET() {
  if (!webPushConfigured()) return NextResponse.json({});
  return NextResponse.json({ publicKey: vapidPublicKey() });
}
