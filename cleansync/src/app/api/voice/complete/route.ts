import { NextResponse } from "next/server";
import { completeByAreaNameAction } from "@/lib/actions";
import { getStore } from "@/lib/store";
import { findAreaByUtterance } from "@/lib/voice";

function unauthorized() {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

function checkVoiceAuth(request: Request): boolean {
  const secret = process.env.VOICE_API_SECRET || process.env.ALEXA_SKILL_ID;
  if (!secret) return true;
  const auth = request.headers.get("authorization");
  const skillId = request.headers.get("x-alexa-skill-id");
  return auth === `Bearer ${secret}` || skillId === secret;
}

export async function POST(request: Request) {
  if (!checkVoiceAuth(request)) return unauthorized();

  const body = (await request.json().catch(() => null)) as
    | { areaName?: string; userId?: string }
    | null;
  const areaName = body?.areaName?.trim();
  if (!areaName) {
    return NextResponse.json({ error: "areaName is required" }, { status: 400 });
  }

  const store = await getStore();
  const area = findAreaByUtterance(store.areas, areaName);
  if (!area) {
    return NextResponse.json({ error: "area not found", areaName }, { status: 404 });
  }

  const result = await completeByAreaNameAction(area.name, body?.userId);
  return NextResponse.json({
    ok: true,
    utterance: `アレクサ、掃除管理で『${area.name}』を完了して`,
    ...result,
  });
}
