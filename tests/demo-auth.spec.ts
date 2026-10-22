import { test, expect } from "@playwright/test";
import { Pool } from "pg";

const origin = "http://localhost:3101";
const simulatedPrefix = "simulated-only:base64:v1:";

async function signIn(request: import("@playwright/test").APIRequestContext, persona: "participant" | "researcher" | "admin") {
  const response = await request.post("/api/demo-auth", { data: { persona } });
  expect(response.ok()).toBeTruthy();
  return response.json();
}

test("simulated personas enforce role, consent, policy-gate, and active-grant checks", async ({ playwright }) => {
  const request = await playwright.request.newContext({ baseURL: origin });
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  let contributionId = "";
  try {
    const participant = await signIn(request, "participant");
    expect(participant.session.realmRoles).toContain("_tide_encryptor");
    expect(participant.session.realmRoles).toContain("_tide_decryptor");

    const sample = Buffer.from(JSON.stringify({ version: 1, synthetic: true, sleepHours: 7.5, studyHours: 3, wellbeing: "good", notes: "Fictional test fixture" })).toString("base64");
    const created = await request.post("/api/vault", { data: { ciphertext: simulatedPrefix + sample } });
    expect(created.status()).toBe(201);
    contributionId = (await created.json()).record.id;

    await signIn(request, "researcher");
    expect((await request.get(`/api/vault?id=${contributionId}`)).status()).toBe(404);
    expect((await request.post("/api/vault", { data: { ciphertext: simulatedPrefix + sample } })).status()).toBe(403);
    expect((await request.get("/api/consent/policies")).status()).toBe(403);
    const requested = await request.post("/api/consent", { data: { contributionId, purpose: "Compare fictional sleep and study patterns." } });
    expect(requested.status()).toBe(201);
    const grantId = (await requested.json()).request.id as string;

    await signIn(request, "participant");
    const selfRequest = await request.post("/api/consent", { data: { contributionId, purpose: "Ask consent for my own record." } });
    expect(selfRequest.status()).toBe(409);
    expect((await selfRequest.json()).error).toContain("own contribution");
    expect((await request.patch(`/api/consent?grantId=${grantId}`, { data: { decision: "approve" } })).status()).toBe(200);

    const admin = await signIn(request, "admin");
    expect(admin.session.clientRoles).toContain("tide-realm-admin");
    expect((await request.get("/api/vault")).status()).toBe(403);
    expect((await request.get("/api/consent/policies")).status()).toBe(200);
    const policyGate = await request.post("/api/consent/policies", { data: { grantId } });
    expect(policyGate.status()).toBe(200);
    expect((await policyGate.json()).simulated).toBe(true);
    const adminQueue = await request.get("/api/consent/policies");
    expect(adminQueue.status()).toBe(200);
    const waitingPolicies = (await adminQueue.json()).requests as Array<{ id: string }>;
    expect(waitingPolicies.some((item) => item.id === grantId)).toBe(false);

    await signIn(request, "participant");
    const ownerActivity = await (await request.get("/api/consent?history=1")).json();
    expect(ownerActivity.asOwner.find((item: { id: string }) => item.id === grantId).policiesReady).toBe(true);
    expect((await request.put(`/api/consent?grantId=${grantId}`, { data: { ciphertext: simulatedPrefix + sample } })).status()).toBe(200);

    await signIn(request, "researcher");
    const researcherActivity = await (await request.get("/api/consent")).json();
    expect(researcherActivity.asResearcher.find((item: { id: string }) => item.id === grantId).policiesReady).toBe(true);
    expect((await request.get(`/api/consent?grantId=${grantId}`)).status()).toBe(200);

    await signIn(request, "participant");
    expect((await request.patch(`/api/consent?grantId=${grantId}`, { data: { decision: "withdraw" } })).status()).toBe(200);
    await signIn(request, "researcher");
    expect((await request.get(`/api/consent?grantId=${grantId}`)).status()).toBe(404);
  } finally {
    if (contributionId) {
      await pool.query('DELETE FROM "AuditEvent" WHERE "resourceId" = $1', [contributionId]);
      await pool.query('DELETE FROM "ConsentGrant" WHERE "contributionId" = $1', [contributionId]);
      await pool.query('DELETE FROM "Contribution" WHERE "id" = $1', [contributionId]);
    }
    await pool.end();
    await request.dispose();
  }
});
