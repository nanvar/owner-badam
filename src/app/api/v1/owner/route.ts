// Health check + small directory of available endpoints — handy for
// confirming the deploy is live without trying every nested route.
export function GET() {
  return Response.json({
    ok: true,
    api: "owner-mobile",
    version: 1,
    endpoints: {
      "POST /auth/login": "{email, password} -> {token, user}",
      "GET /me": "current owner profile",
      "GET /summary": "dashboard KPIs (?range=this-month|last-month|...)",
      "GET /calendar": "per-property events",
      "GET /upcoming": "pipeline reservations",
      "GET /payments": "recorded settlement payments",
      "GET /reports": "report list",
      "GET /reports/:id": "single report",
      "GET /reports/:id/pdf": "PDF binary",
      "POST /devices": "{token, platform} register Expo push token",
      "DELETE /devices?token=...": "unregister",
    },
  });
}
