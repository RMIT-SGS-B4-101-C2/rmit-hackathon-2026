import { NextRequest } from "next/server";
import { verifyTideJWT, extractToken } from "./tideJWT";
import { verifyDpop } from "./verifyDpop";
import type { JWTPayload } from "jose";

type AuthHandler = (req: NextRequest, jwt: JWTPayload, token: string) => Promise<Response>;

export function withAuth(handler: AuthHandler) {
  return async (req: NextRequest) => {
    try {
      const token = extractToken(req.headers.get("authorization"));
      const jwt = await verifyTideJWT(token);
      // The signature alone is not enough. This realm issues sender-constrained tokens (cnf.jkt),
      // and without checking the DPoP proof a stolen token replays as a plain `Bearer` and passes
      // (AP-43). verifyDpop rejects an unbound token, a Bearer-scheme replay, a proof signed by a
      // different key, and a proof for another URL or method. It throws; the catch below answers 401.
      await verifyDpop(req, token, jwt as { cnf?: { jkt?: string } }, { trustForwardedHeaders: false });
      return handler(req, jwt, token);
    } catch {
      return Response.json(
        { error: "Authentication required. Please sign in again." },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }
  };
}

export function withRole(role: string, handler: AuthHandler) {
  return withAuth(async (req, jwt, token) => {
    if (!((jwt.realm_access as { roles?: string[] })?.roles ?? []).includes(role)) {
      return Response.json({ error: "Forbidden" }, { status: 403, headers: { "Cache-Control": "no-store" } });
    }
    return handler(req, jwt, token);
  });
}

export function withClientRole(clientId: string, role: string, handler: AuthHandler) {
  return withAuth(async (req, jwt, token) => {
    const clients = jwt.resource_access as Record<string, { roles?: string[] }> | undefined;
    if (!(clients?.[clientId]?.roles ?? []).includes(role)) {
      return Response.json({ error: "Forbidden" }, { status: 403, headers: { "Cache-Control": "no-store" } });
    }
    return handler(req, jwt, token);
  });
}
