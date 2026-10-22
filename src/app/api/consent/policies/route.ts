import { Models } from "@tideorg/js";
import { withClientRole } from "@/lib/auth/middleware";
import { loadTideConfig } from "@/lib/auth/tidecloakConfig";
import { recordIdSchema, signedPolicySchema } from "@/lib/survey";
import { attachConsentPolicies, getConsentPolicyContext, listPolicyQueue } from "@/lib/vault-store";

export const runtime = "nodejs";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function decodePolicy(encoded: string) {
  const bytes = Buffer.from(encoded, "base64");
  if (bytes.toString("base64") !== encoded) throw new Error("invalid base64");
  return Models.Policy.from(new Uint8Array(bytes));
}

function validatePolicy(encoded: string, options: { subjectKey: string; recordId: string; role: string; vendorId: string; expiresAt: Date }) {
  const policy = decodePolicy(encoded);
  const param = (name: string) => policy.params.entries.get(name);
  let roles: unknown;
  try { roles = JSON.parse(String(param("roles"))); } catch { throw new Error("invalid roles"); }
  const expiry = policy.expiry === undefined ? NaN : Number(policy.expiry);
  if (
    policy.contractId !== "RelationshipAttestation:1" ||
    !policy.modelIds.includes("PolicyEnabledEncryption:1") ||
    !policy.modelIds.includes("PolicyEnabledDecryption:1") ||
    policy.keyId !== options.vendorId ||
    policy.approvalType !== Models.ApprovalType.IMPLICIT ||
    policy.executionType !== Models.ExecutionType.PRIVATE ||
    param("subjectType") !== "User" ||
    param("subjectId") !== options.subjectKey ||
    param("assignmentId") !== options.recordId ||
    !Array.isArray(roles) || roles.length !== 1 || roles[0] !== options.role ||
    !policy.signature?.length ||
    !Number.isFinite(expiry) || expiry <= Math.floor(Date.now() / 1000) || expiry > Math.floor(options.expiresAt.getTime() / 1000)
  ) throw new Error("policy does not match the approved grant");
}

export const GET = withClientRole("realm-management", "tide-realm-admin", async () => {
  try { return json({ requests: await listPolicyQueue() }); }
  catch { return json({ error: "Policy queue is unavailable." }, 503); }
});

export const POST = withClientRole("realm-management", "tide-realm-admin", async (req, jwt) => {
  try {
    const body = await req.json();
    if (jwt.demo_mode === true) {
      const grantId = body && typeof body === "object" && "grantId" in body && typeof body.grantId === "string" ? body.grantId : "";
      if (!recordIdSchema.safeParse(grantId).success) return json({ error: "Choose a valid consent request." }, 400);
      const attached = await attachConsentPolicies(jwt.sub!, grantId, "SIMULATED_TIDECLOAK_POLICY:read:_tide_decryptor", "SIMULATED_TIDECLOAK_POLICY:write:_tide_encryptor", true);
      return attached ? json({ attached: true, simulated: true }) : json({ error: "This consent request is not waiting for policy approval." }, 409);
    }
    const parsed = signedPolicySchema.safeParse(body);
    if (!parsed.success) return json({ error: "Both signed policies are required." }, 400);
    const grant = await getConsentPolicyContext(parsed.data.grantId);
    if (!grant || grant.status !== "PENDING_POLICY" || grant.expiresAt <= new Date()) return json({ error: "This approved request is no longer available for policy setup." }, 409);
    if (!grant.researcherTideKey || !grant.contribution.participantTideKey) return json({ error: "The participant or researcher is missing a Tide User Key. They must sign in after the realm User Key mapper is enabled." }, 409);
    const config = loadTideConfig();
    if (!config.vendorId) return json({ error: "Tide adapter is missing its vendorId." }, 503);
    try {
      validatePolicy(parsed.data.readPolicy, { subjectKey: grant.researcherTideKey, recordId: grant.contributionId, role: "_tide_decryptor", vendorId: config.vendorId, expiresAt: grant.expiresAt });
      validatePolicy(parsed.data.ownerWritePolicy, { subjectKey: grant.contribution.participantTideKey, recordId: grant.contributionId, role: "_tide_encryptor", vendorId: config.vendorId, expiresAt: grant.expiresAt });
    } catch {
      return json({ error: "The Tide policies must be signed, name the expected users and record, grant only their single operation, and expire no later than consent." }, 400);
    }
    const attached = await attachConsentPolicies(jwt.sub!, parsed.data.grantId, parsed.data.readPolicy, parsed.data.ownerWritePolicy);
    return attached ? json({ attached: true }) : json({ error: "Unable to attach policies to this request." }, 409);
  } catch {
    return json({ error: "Unable to process the signed Tide policies." }, 400);
  }
});
