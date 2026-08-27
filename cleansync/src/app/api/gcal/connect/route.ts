import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { connectMockAccount } from "@/lib/gcal";
import {
  authorizationUrl,
  isMockCalendar,
  isOAuthConfigured,
  oauthRedirectUri,
} from "@/lib/gcal-oauth";

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;

  if (isMockCalendar()) {
    await connectMockAccount();
    return NextResponse.redirect(new URL("/settings?gcal=mock", origin));
  }

  if (!isOAuthConfigured()) {
    return NextResponse.redirect(new URL("/settings?gcal=missing_env", origin));
  }

  const state = randomUUID();
  const jar = await cookies();
  jar.set("gcal_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: origin.startsWith("https://"),
    path: "/",
    maxAge: 600,
  });

  const url = authorizationUrl({
    clientId: process.env.GOOGLE_CALENDAR_CLIENT_ID ?? "",
    redirectUri: oauthRedirectUri(origin),
    state,
  });
  return NextResponse.redirect(url);
}
