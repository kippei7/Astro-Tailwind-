import { NextResponse } from "next/server";
import { completeByAreaNameAction } from "@/lib/actions";
import { getStore } from "@/lib/store";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { areaName?: string; userId?: string }
    | null;
  const areaName = body?.areaName?.trim();
  if (!areaName) {
    return NextResponse.json({ error: "areaName is required" }, { status: 400 });
  }

  const store = await getStore();
  const area = store.areas.find((item) => item.name === areaName);
  if (!area) {
    return NextResponse.json({ error: "area not found", areaName }, { status: 404 });
  }

  const result = await completeByAreaNameAction(areaName, body?.userId);
  return NextResponse.json({
    ok: true,
    utterance: `アレクサ、掃除管理で『${areaName}』を完了して`,
    ...result,
  });
}
