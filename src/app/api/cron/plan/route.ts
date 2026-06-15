import { NextRequest, NextResponse } from "next/server";
import { inngest } from "@/inngest/client";
import {
  DEFAULT_LUA_PERSONA_ID,
  PLAN_CONTENT_EVENT_NAME,
} from "@/config/constants";

export const runtime = "nodejs";

function getCronSecret(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const bearerSecret = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : undefined;

  return (
    bearerSecret ??
    request.headers.get("x-cron-secret") ??
    request.nextUrl.searchParams.get("secret")
  );
}

function assertAuthorized(request: NextRequest) {
  const expected = process.env.CRON_SECRET;

  if (!expected) {
    throw new Error("CRON_SECRET is not configured.");
  }

  if (getCronSecret(request) !== expected) {
    return false;
  }

  return true;
}

export async function GET(request: NextRequest) {
  if (!assertAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const personaId =
    request.nextUrl.searchParams.get("personaId") ?? DEFAULT_LUA_PERSONA_ID;
  const ids = await inngest.send({
    name: PLAN_CONTENT_EVENT_NAME,
    data: {
      personaId,
      source: "cron",
    },
  });

  return NextResponse.json({
    ok: true,
    event: PLAN_CONTENT_EVENT_NAME,
    ids,
  });
}

export async function POST(request: NextRequest) {
  if (!assertAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    personaId?: string;
  };
  const ids = await inngest.send({
    name: PLAN_CONTENT_EVENT_NAME,
    data: {
      personaId: body.personaId ?? DEFAULT_LUA_PERSONA_ID,
      source: "cron",
    },
  });

  return NextResponse.json({
    ok: true,
    event: PLAN_CONTENT_EVENT_NAME,
    ids,
  });
}
