import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(
    {
      ok: false,
      endpoint: "daily-plan-cron",
      message: "Not implemented in phase 1.",
    },
    { status: 501 },
  );
}

export const POST = GET;
