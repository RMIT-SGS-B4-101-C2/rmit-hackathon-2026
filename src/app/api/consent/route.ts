import { withRole } from "@/lib/auth/middleware";
import { consentDecisionSchema, consentRequestSchema, recordIdSchema } from "@/lib/survey";
import { decideConsent, getOwnerShareMaterials, getResearcherGrant, listAuditHistory, listConsentActivity, listStudyDirectory, requestConsent, saveSharedCiphertext } from "@/lib/vault-store";
import { z } from "zod";

export const runtime = "nodejs";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

async function bodyJson(req: Request, limit = 16 * 1024) {
  const raw = await req.text();
  if (raw.length > limit) throw new Error("too-large");
  return JSON.parse(raw);
}

export const GET = withRole("appUser", async (req, jwt) => {
  try {
    const url = new URL(req.url);
    const grantId = url.searchParams.get("grantId");
    if (grantId) {
      if (!recordIdSchema.safeParse(grantId).success) return json({ error: "Invalid request" }, 400);
      if (url.searchParams.get("shareMaterials") === "1") {
        const materials = await getOwnerShareMaterials(jwt.sub!, grantId);
        return materials ? json({ materials }) : json({ error: "Consent or Tide policy is not ready." }, 404);
      }
      const grant = await getResearcherGrant(jwt.sub!, grantId);
      return grant ? json({ grant }) : json({ error: "No active consent for this record." }, 404);
    }
    const [activity, directory, history] = await Promise.all([
      listConsentActivity(jwt.sub!),
      url.searchParams.get("directory") === "1" ? listStudyDirectory() : Promise.resolve(undefined),
      url.searchParams.get("history") === "1" ? listAuditHistory(jwt.sub!) : Promise.resolve(undefined),
    ]);
    return json({ ...activity, ...(directory ? { directory } : {}), ...(history ? { history } : {}) });
  } catch {
    return json({ error: "Consent information is unavailable. Please try again." }, 503);
  }
});

export const POST = withRole("appUser", async (req, jwt) => {
  try {
    const parsed = consentRequestSchema.safeParse(await bodyJson(req));
    if (!parsed.success) return json({ error: "Enter a record ID and a clear purpose (12–500 characters)." }, 400);
    const researcherTideKey = typeof jwt.tideuserkey === "string" ? jwt.tideuserkey.trim() : "";
    if (!researcherTideKey) return json({ error: "Your Tide identity has no tideuserkey claim yet. Ask the realm administrator to enable the Tide User Key mapper, then sign in again." }, 409);
    const result = await requestConsent(jwt.sub!, researcherTideKey, parsed.data.contributionId, parsed.data.purpose);
    if (!result) return json({ error: "That contribution is unavailable for requests." }, 404);
    if ("duplicate" in result) return json({ error: "You already have an active or pending request for this contribution." }, 409);
    return json({ request: result }, 201);
  } catch {
    return json({ error: "Unable to create the consent request." }, 503);
  }
});

export const PATCH = withRole("appUser", async (req, jwt) => {
  const grantId = new URL(req.url).searchParams.get("grantId");
  if (!recordIdSchema.safeParse(grantId).success) return json({ error: "Invalid request" }, 400);
  try {
    const parsed = consentDecisionSchema.safeParse(await bodyJson(req));
    if (!parsed.success) return json({ error: "Invalid consent decision." }, 400);
    const result = await decideConsent(jwt.sub!, grantId!, parsed.data.decision);
    if (result === "missing") return json({ error: "Consent request not found." }, 404);
    if (result === "conflict") return json({ error: "This request has already changed state." }, 409);
    return json({ status: result });
  } catch {
    return json({ error: "Unable to update consent." }, 503);
  }
});

const sharedSchema = z.object({ ciphertext: z.string().min(16).max(64 * 1024) }).strict();

export const PUT = withRole("appUser", async (req, jwt) => {
  const grantId = new URL(req.url).searchParams.get("grantId");
  if (!recordIdSchema.safeParse(grantId).success) return json({ error: "Invalid request" }, 400);
  try {
    const parsed = sharedSchema.safeParse(await bodyJson(req, 70 * 1024));
    if (!parsed.success) return json({ error: "Expected an encrypted shared record." }, 400);
    const saved = await saveSharedCiphertext(jwt.sub!, grantId!, parsed.data.ciphertext);
    return saved ? json({ saved: true }) : json({ error: "Consent or Tide policy is not ready." }, 409);
  } catch {
    return json({ error: "Unable to save the encrypted share." }, 503);
  }
});
