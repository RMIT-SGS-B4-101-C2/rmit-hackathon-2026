import { NextRequest, NextResponse } from "next/server";
import { createDemoSession, DEMO_COOKIE, DEMO_TTL_SECONDS, demoAuthEnabled, demoPersonaSummary, demoSessionSummary, isDemoPersona, readDemoSession } from "@/lib/auth/demo-session";

export const runtime = "nodejs";

function cookieOptions(request: NextRequest) {
  return {
    httpOnly: true,
    sameSite: "strict" as const,
    secure: request.nextUrl.protocol === "https:",
    path: "/",
    maxAge: DEMO_TTL_SECONDS,
  };
}

function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  return !origin || origin === request.nextUrl.origin;
}

export async function GET(request: NextRequest) {
  if (!demoAuthEnabled()) return Response.json({ enabled: false, session: null }, { headers: { "Cache-Control": "no-store" } });
  const session = await readDemoSession(request);
  return Response.json({ enabled: true, session: demoSessionSummary(session) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  if (!demoAuthEnabled()) return Response.json({ error: "Simulated TideCloak sign-in is disabled." }, { status: 404, headers: { "Cache-Control": "no-store" } });
  if (!sameOrigin(request)) return Response.json({ error: "Cross-origin sign-in is not allowed." }, { status: 403, headers: { "Cache-Control": "no-store" } });
  try {
    const body: unknown = await request.json();
    const persona = body && typeof body === "object" && "persona" in body ? body.persona : null;
    if (!isDemoPersona(persona)) return Response.json({ error: "Choose a supported simulated persona." }, { status: 400, headers: { "Cache-Control": "no-store" } });
    const response = NextResponse.json({ session: demoPersonaSummary(persona) }, { headers: { "Cache-Control": "no-store" } });
    response.cookies.set(DEMO_COOKIE, await createDemoSession(persona), cookieOptions(request));
    return response;
  } catch {
    return Response.json({ error: "Could not start the simulated session." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
}

export async function DELETE(request: NextRequest) {
  if (!demoAuthEnabled()) return Response.json({ error: "Simulated TideCloak sign-in is disabled." }, { status: 404, headers: { "Cache-Control": "no-store" } });
  if (!sameOrigin(request)) return Response.json({ error: "Cross-origin sign-out is not allowed." }, { status: 403, headers: { "Cache-Control": "no-store" } });
  const response = NextResponse.json({ signedOut: true }, { headers: { "Cache-Control": "no-store" } });
  response.cookies.set(DEMO_COOKIE, "", { ...cookieOptions(request), maxAge: 0 });
  return response;
}
