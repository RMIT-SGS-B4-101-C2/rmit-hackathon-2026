import { test, expect } from "@playwright/test";
import { calculateJwkThumbprint, exportJWK, generateKeyPair, importJWK, SignJWT, base64url } from "jose";
import { createHash, randomUUID } from "node:crypto";

const origin = "http://localhost:3101";
const issuer = "http://localhost:8999/realms/security-test";
const owner = `test-owner-${randomUUID()}`;
const stranger = `test-stranger-${randomUUID()}`;
const ciphertext = Buffer.from("opaque ciphertext fixture; no survey answers").toString("base64");

async function credentials(subject: string | undefined, roles = ["appUser"], expired = false) {
  const pair = await generateKeyPair("ES256");
  const jwk = await exportJWK(pair.publicKey);
  const jkt = await calculateJwkThumbprint(jwk);
  const signingKey = await importJWK(JSON.parse(process.env.TEST_TIDE_PRIVATE_JWK!), "EdDSA");
  let jwt = new SignJWT({ azp: "security-test-client", realm_access: { roles }, cnf: { jkt } })
    .setProtectedHeader({ alg: "EdDSA", kid: "test-key" }).setIssuer(issuer).setIssuedAt()
    .setExpirationTime(expired ? Math.floor(Date.now() / 1000) - 30 : "5m");
  if (subject !== undefined) jwt = jwt.setSubject(subject);
  const token = await jwt.sign(signingKey);
  async function headers(path: string, method = "GET") {
    const url = new URL(path, origin);
    const proof = await new SignJWT({
      htu: `${url.origin}${url.pathname}`, htm: method,
      ath: base64url.encode(createHash("sha256").update(token).digest()),
    }).setProtectedHeader({ alg: "ES256", typ: "dpop+jwt", jwk }).setIssuedAt().setJti(randomUUID()).sign(pair.privateKey);
    return { Authorization: `DPoP ${token}`, DPoP: proof };
  }
  return { token, headers };
}

test("authentication requires a valid token, subject, role, and bound proof", async ({ request }) => {
  expect((await request.get("/api/vault")).status()).toBe(401);
  const account = await credentials(owner);
  const good = await account.headers("/api/vault");
  expect((await request.get("/api/vault", { headers: { ...good, Authorization: `Bearer ${account.token}` } })).status()).toBe(401);
  expect((await request.get("/api/vault", { headers: { Authorization: good.Authorization } })).status()).toBe(401);
  const second = await credentials(stranger);
  expect((await request.get("/api/vault", { headers: { ...await second.headers("/api/vault"), Authorization: good.Authorization } })).status()).toBe(401);
  const noSubject = await credentials(undefined);
  expect((await request.get("/api/vault", { headers: await noSubject.headers("/api/vault") })).status()).toBe(401);
  const noRole = await credentials(owner, []);
  expect((await request.get("/api/vault", { headers: await noRole.headers("/api/vault") })).status()).toBe(403);
  const expired = await credentials(owner, ["appUser"], true);
  expect((await request.get("/api/vault", { headers: await expired.headers("/api/vault") })).status()).toBe(401);
});

test("a DPoP proof cannot be replayed or used for another method or path", async ({ request }) => {
  const account = await credentials(owner);
  const headers = await account.headers("/api/vault");
  expect((await request.get("/api/vault", { headers })).status()).toBe(200);
  expect((await request.get("/api/vault", { headers })).status()).toBe(401);
  expect((await request.post("/api/vault", { headers: await account.headers("/api/vault", "GET"), data: { ciphertext } })).status()).toBe(401);
  expect((await request.get("/api/vault", { headers: await account.headers("/api/other") })).status()).toBe(401);
});

test("records persist and every read/delete enforces the signed owner", async ({ request }) => {
  const alice = await credentials(owner);
  const bob = await credentials(stranger, ["appUser", "admin"]);
  const created = await request.post("/api/vault", { headers: await alice.headers("/api/vault", "POST"), data: { ciphertext } });
  expect(created.status()).toBe(201);
  const { record } = await created.json();
  const path = `/api/vault?id=${record.id}`;
  try {
    const own = await request.get(path, { headers: await alice.headers(path) });
    expect(own.status()).toBe(200);
    expect((await own.json()).record.ciphertext).toBe(ciphertext);
    expect(own.headers()["cache-control"]).toBe("no-store");
    const newOwnerSession = await credentials(owner);
    const list = await request.get("/api/vault", { headers: await newOwnerSession.headers("/api/vault") });
    expect((await list.json()).records.some((row: { id: string }) => row.id === record.id)).toBe(true);
    const otherList = await request.get("/api/vault", { headers: await bob.headers("/api/vault") });
    expect((await otherList.json()).records).toEqual([]);
    expect((await request.get(path, { headers: await bob.headers(path) })).status()).toBe(404);
    expect((await request.delete(path, { headers: await bob.headers(path, "DELETE") })).status()).toBe(404);
    expect((await request.get(path, { headers: await alice.headers(path) })).status()).toBe(200);
  } finally {
    expect((await request.delete(path, { headers: await alice.headers(path, "DELETE") })).status()).toBe(200);
  }
  expect((await request.get(path, { headers: await alice.headers(path) })).status()).toBe(404);
});

test("uploads reject plaintext fields, spoofed ownership, invalid JSON, and oversize envelopes", async ({ request }) => {
  const account = await credentials(owner);
  async function post(data: unknown) {
    return request.post("/api/vault", { headers: await account.headers("/api/vault", "POST"), data });
  }
  expect((await post({ sleepHours: 8, studyHours: 2 })).status()).toBe(400);
  expect((await post({ ciphertext, participantSubject: stranger })).status()).toBe(400);
  expect((await post({ ciphertext, notes: "plaintext must never be uploaded" })).status()).toBe(400);
  expect((await post("{broken-json")).status()).toBe(400);
  expect((await post({ ciphertext: "x".repeat(80 * 1024) })).status()).toBe(413);
});
