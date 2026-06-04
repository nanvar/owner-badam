// DELETE /api/v1/owner/stay-requests/:id — cancel a pending request.

import { NextRequest, NextResponse } from "next/server";
import { readBearerSession } from "@/lib/api-auth";
import { readSession } from "@/lib/auth";
import { cancelOwnerReservationRequestAction } from "@/app/actions/owner-stay";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const cookieSession = await readSession();
  const bearerSession = cookieSession ? null : await readBearerSession(req);
  const session = cookieSession ?? bearerSession;
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (session.role !== "OWNER") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { id } = await params;
  try {
    await cancelOwnerReservationRequestAction(id);
    return NextResponse.json({ status: "ok" });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "failed" },
      { status: 400 },
    );
  }
}
