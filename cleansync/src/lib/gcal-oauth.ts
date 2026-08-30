export const GCAL_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

const CLIENT_ID_RE = /[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com/i;

/** Cloud Console のクライアント詳細URLを貼っても、本物の Client ID だけ取り出す */
export function normalizeGoogleClientId(raw: string): string {
  const value = raw.trim();
  const match = value.match(CLIENT_ID_RE);
  return match?.[0] ?? value;
}

export function googleClientId(): string {
  return normalizeGoogleClientId(process.env.GOOGLE_CALENDAR_CLIENT_ID ?? "");
}

export function isGoogleClientIdShapeValid(id = googleClientId()): boolean {
  return CLIENT_ID_RE.test(id);
}

export function rawGoogleClientIdWasConsoleUrl(): boolean {
  const raw = (process.env.GOOGLE_CALENDAR_CLIENT_ID ?? "").trim();
  return /^https?:\/\//i.test(raw) && CLIENT_ID_RE.test(raw);
}

export function isOAuthConfigured(): boolean {
  return Boolean(googleClientId() && process.env.GOOGLE_CALENDAR_CLIENT_SECRET);
}

export function isMockCalendarEventId(id: string | null | undefined): boolean {
  return Boolean(id?.startsWith("gcal-mock-"));
}

export function hasLiveCalendarSync(id: string | null | undefined): boolean {
  if (!id) return false;
  if (isMockCalendar()) return true;
  return !isMockCalendarEventId(id);
}

export function isMockCalendar(): boolean {
  const value = process.env.GCAL_MOCK?.toLowerCase();
  return value === "1" || value === "true";
}

export function oauthRedirectUri(origin: string): string {
  return (
    process.env.GOOGLE_CALENDAR_REDIRECT_URI?.trim() ||
    `${origin.replace(/\/$/, "")}/api/gcal/callback`
  );
}

export function authorizationUrl(opts: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const params = new URLSearchParams({
    client_id: opts.clientId,
    redirect_uri: opts.redirectUri,
    response_type: "code",
    scope: GCAL_SCOPES,
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "consent",
    state: opts.state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeCodeForTokens(opts: {
  code: string;
  redirectUri: string;
}): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}> {
  const body = new URLSearchParams({
    code: opts.code,
    client_id: googleClientId(),
    client_secret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET ?? "",
    redirect_uri: opts.redirectUri,
    grant_type: "authorization_code",
  });
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`token exchange failed (${response.status}): ${text.slice(0, 240)}`);
  }
  return response.json();
}

export async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string;
  expires_in: number;
}> {
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: googleClientId(),
    client_secret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET ?? "",
    grant_type: "refresh_token",
  });
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`token refresh failed (${response.status}): ${text.slice(0, 240)}`);
  }
  return response.json();
}

export async function fetchGoogleEmail(accessToken: string): Promise<string | null> {
  const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) return null;
  const data = (await response.json()) as { email?: string };
  return data.email ?? null;
}

export async function revokeGoogleToken(token: string): Promise<void> {
  await fetch("https://oauth2.googleapis.com/revoke", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token }),
  }).catch(() => undefined);
}
