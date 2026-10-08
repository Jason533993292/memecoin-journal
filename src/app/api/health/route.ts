import { NextResponse } from "next/server";

// Platform liveness endpoint. This intentionally does not disclose secrets or
// depend on either database while the app supports a staged backend migration.
export function GET() {
  return NextResponse.json(
    { status: "ok" },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
