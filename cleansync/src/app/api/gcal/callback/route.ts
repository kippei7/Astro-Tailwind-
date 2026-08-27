import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { saveOAuthTokens } from "@/lib/gcal";
import { exchangeCodeForTokens, oauthRedirectUri } from "@/lib/gcal-oauth";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;
  const error = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const jar = await cookies();
  const expected = jar.get("gcal_oauth_state")?.value;
  jar.delete("gcal_oauth_state");

  if (error || !code || !state || !expected || state !== expected) {
    return NextResponse.redirect(new URL("/settings?gcal=error", origin));
  }

  try {
    const tokens = await exchangeCodeForTokens({
      code,
      redirectUri: oauthRedirectUri(origin),
    });
    await saveOAuthTokens({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresIn: tokens.expires_in,
    });
    return NextResponse.redirect(new URL("/settings?gcal=connected", origin));
  } catch (cause) {
    console.error("gcal oauth callback failed", cause);
    return NextResponse.redirect(new URL("/settings?gcal=error", origin));
  }
}
