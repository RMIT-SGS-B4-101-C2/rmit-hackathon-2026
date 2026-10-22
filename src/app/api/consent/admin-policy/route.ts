import { withClientRole } from "@/lib/auth/middleware";
import { loadTideConfig } from "@/lib/auth/tidecloakConfig";

export const runtime = "nodejs";

export const GET = withClientRole("realm-management", "tide-realm-admin", async (_req, _jwt, token) => {
  try {
    const config = loadTideConfig();
    const endpoint = `${config["auth-server-url"].replace(/\/+$/, "")}/admin/realms/${encodeURIComponent(config.realm)}/iga/role-policies/name/tide-realm-admin`;
    const upstream = await fetch(endpoint, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!upstream.ok) return Response.json({ error: "Tide did not return the realm-admin policy." }, { status: upstream.status === 401 || upstream.status === 403 ? upstream.status : 502, headers: { "Cache-Control": "no-store" } });
    const body = await upstream.json() as { policy?: unknown };
    if (typeof body.policy !== "string" || !body.policy) return Response.json({ error: "Tide response did not include the admin policy." }, { status: 502, headers: { "Cache-Control": "no-store" } });
    return Response.json({ policy: body.policy }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Unable to retrieve the realm-admin signing policy." }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
});
