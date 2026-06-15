import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      endpoint: "platform-publication-webhook",
      message: "Not implemented in phase 1.",
    },
    { status: 501 },
  );
}
