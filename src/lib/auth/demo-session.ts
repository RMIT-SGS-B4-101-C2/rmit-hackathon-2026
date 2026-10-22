import { jwtVerify, SignJWT, type JWTPayload } from "jose";
import type { NextRequest } from "next/server";

export const DEMO_COOKIE = "rvc_demo_session";
export const DEMO_TTL_SECONDS = 4 * 60 * 60;
export type DemoPersona = "participant" | "researcher" | "admin";

const personaClaims: Record<DemoPersona, { sub: string; username: string; tideuserkey: string; realmRoles: string[]; clientRoles: string[] }> = {
  participant: {
    sub: "demo-participant",
    username: "demo-participant",
    tideuserkey: "SIMULATED-TIDE-KEY-PARTICIPANT",
    realmRoles: ["appUser", "_tide_enabled", "_tide_encryptor", "_tide_decryptor"],
    clientRoles: [],
  },
  researcher: {
    sub: "demo-researcher",
    username: "demo-researcher",
    tideuserkey: "SIMULATED-TIDE-KEY-RESEARCHER",
    realmRoles: ["appUser", "_tide_enabled", "_tide_decryptor"],
    clientRoles: [],
  },
  admin: {
    sub: "demo-admin",
    username: "demo-admin",
    tideuserkey: "SIMULATED-TIDE-KEY-ADMIN",
    realmRoles: ["_tide_enabled"],
    clientRoles: ["tide-realm-admin"],
  },
};

export function demoAuthEnabled() {
  return process.env.NODE_ENV === "development" &&
    process.env.DEMO_AUTH_ENABLED === "true" &&
    Boolean(process.env.DEMO_AUTH_SECRET && process.env.DEMO_AUTH_SECRET.length >= 32);
}

function signingKey() {
  if (!demoAuthEnabled()) throw new Error("Simulated TideCloak sign-in is disabled.");
  return new TextEncoder().encode(process.env.DEMO_AUTH_SECRET!);
}

export function isDemoPersona(value: unknown): value is DemoPersona {
  return value === "participant" || value === "researcher" || value === "admin";
}

export async function createDemoSession(persona: DemoPersona) {
  const claims = personaClaims[persona];
  return new SignJWT({
    auth_source: "simulated_tidecloak",
    demo_mode: true,
    persona,
    tideuserkey: claims.tideuserkey,
    preferred_username: claims.username,
    realm_access: { roles: claims.realmRoles },
    resource_access: { "realm-management": { roles: claims.clientRoles } },
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer("research-consent-vault-demo")
    .setAudience("research-consent-vault-app")
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime(`${DEMO_TTL_SECONDS}s`)
    .sign(signingKey());
}

export async function readDemoSession(request: NextRequest): Promise<JWTPayload | null> {
  if (!demoAuthEnabled()) return null;
  const token = request.cookies.get(DEMO_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, signingKey(), {
      algorithms: ["HS256"],
      issuer: "research-consent-vault-demo",
      audience: "research-consent-vault-app",
      requiredClaims: ["sub", "exp", "iat"],
    });
    if (payload.demo_mode !== true || payload.auth_source !== "simulated_tidecloak" || !isDemoPersona(payload.persona)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function demoSessionSummary(payload: JWTPayload | null) {
  if (!payload || !isDemoPersona(payload.persona)) return null;
  return {
    persona: payload.persona,
    username: payload.preferred_username,
    subject: payload.sub,
    tideuserkey: payload.tideuserkey,
    realmRoles: (payload.realm_access as { roles?: string[] } | undefined)?.roles ?? [],
    clientRoles: (payload.resource_access as Record<string, { roles?: string[] }> | undefined)?.["realm-management"]?.roles ?? [],
  };
}

export function demoPersonaSummary(persona: DemoPersona) {
  const claims = personaClaims[persona];
  return {
    persona,
    username: claims.username,
    subject: claims.sub,
    tideuserkey: claims.tideuserkey,
    realmRoles: claims.realmRoles,
    clientRoles: claims.clientRoles,
  };
}

