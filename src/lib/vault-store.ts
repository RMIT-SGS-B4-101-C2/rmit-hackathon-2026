import { getDb } from "./db";
import { ENCRYPTION_TAG, STUDY } from "./survey";

const fields = { id: true, studyId: true, ciphertext: true, encryptionTag: true, createdAt: true } as const;

export async function listRecords(subject: string) {
  return getDb().contribution.findMany({
    where: { participantSubject: subject, studyId: STUDY.id },
    select: fields, orderBy: { createdAt: "desc" }, take: 100,
  });
}

export async function findRecord(subject: string, id: string) {
  return getDb().contribution.findFirst({
    where: { id, participantSubject: subject, studyId: STUDY.id }, select: fields,
  });
}

export async function createRecord(subject: string, tideUserKey: string, ciphertext: string) {
  return getDb().$transaction(async (db) => {
    await db.study.upsert({ where: { id: STUDY.id }, update: {}, create: STUDY });
    const record = await db.contribution.create({
      data: { participantSubject: subject, participantTideKey: tideUserKey, studyId: STUDY.id, ciphertext, encryptionTag: ENCRYPTION_TAG },
      select: fields,
    });
    await db.auditEvent.create({ data: { actor: subject, action: "CONTRIBUTION_CREATED", resourceId: record.id } });
    return record;
  });
}

export async function deleteRecord(subject: string, id: string) {
  return getDb().$transaction(async (db) => {
    const deleted = await db.contribution.deleteMany({ where: { id, participantSubject: subject, studyId: STUDY.id } });
    if (deleted.count) {
      await db.auditEvent.create({ data: { actor: subject, action: "CONTRIBUTION_DELETED", resourceId: id } });
    }
    return deleted.count > 0;
  });
}

export async function listConsentActivity(subject: string) {
  const db = getDb();
  const [asOwner, asResearcher] = await Promise.all([
    db.consentGrant.findMany({
      where: { contribution: { participantSubject: subject, studyId: STUDY.id } },
      select: { id: true, contributionId: true, researcherSubject: true, purpose: true, status: true, expiresAt: true, withdrawnAt: true, createdAt: true, signedPolicy: true, ownerWritePolicy: true },
      orderBy: { createdAt: "desc" }, take: 100,
    }),
    db.consentGrant.findMany({
      where: { researcherSubject: subject },
      select: { id: true, contributionId: true, purpose: true, status: true, expiresAt: true, withdrawnAt: true, createdAt: true },
      orderBy: { createdAt: "desc" }, take: 100,
    }),
  ]);
  const now = new Date();
  return {
    asOwner: asOwner.map(({ signedPolicy, ownerWritePolicy, ...grant }) => ({ ...grant, status: grant.expiresAt <= now && ["REQUESTED", "PENDING_POLICY", "ACTIVE"].includes(grant.status) ? "EXPIRED" : grant.status, policiesReady: Boolean(signedPolicy && ownerWritePolicy) })),
    asResearcher: asResearcher.map((grant) => ({ ...grant, status: grant.expiresAt <= now && ["REQUESTED", "PENDING_POLICY", "ACTIVE"].includes(grant.status) ? "EXPIRED" : grant.status })),
  };
}

export async function listPolicyQueue() {
  return getDb().consentGrant.findMany({
    where: { status: "PENDING_POLICY", expiresAt: { gt: new Date() } },
    select: { id: true, contributionId: true, researcherTideKey: true, purpose: true, expiresAt: true, contribution: { select: { participantTideKey: true } } },
    orderBy: { createdAt: "asc" }, take: 100,
  });
}

export async function listStudyDirectory() {
  return getDb().contribution.findMany({
    where: { studyId: STUDY.id },
    select: { id: true, createdAt: true },
    orderBy: { createdAt: "desc" }, take: 100,
  });
}

export async function requestConsent(researcherSubject: string, researcherTideKey: string, contributionId: string, purpose: string) {
  return getDb().$transaction(async (db) => {
    const contribution = await db.contribution.findFirst({ where: { id: contributionId, studyId: STUDY.id }, select: { participantSubject: true } });
    if (!contribution || contribution.participantSubject === researcherSubject) return null;
    const pending = await db.consentGrant.findFirst({
      where: { contributionId, researcherSubject, status: { in: ["REQUESTED", "PENDING_POLICY", "ACTIVE"] }, expiresAt: { gt: new Date() } },
      select: { id: true },
    });
    if (pending) return { duplicate: true as const };
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    const grant = await db.consentGrant.create({
      data: { contributionId, researcherSubject, researcherTideKey, purpose, status: "REQUESTED", expiresAt },
      select: { id: true, contributionId: true, purpose: true, status: true, expiresAt: true, createdAt: true },
    });
    await db.auditEvent.create({ data: { actor: researcherSubject, action: "CONSENT_REQUESTED", resourceId: contributionId, details: { grantId: grant.id, purpose } } });
    return grant;
  });
}

export async function decideConsent(ownerSubject: string, grantId: string, decision: "approve" | "deny" | "withdraw") {
  return getDb().$transaction(async (db) => {
    const grant = await db.consentGrant.findFirst({
      where: { id: grantId, contribution: { participantSubject: ownerSubject, studyId: STUDY.id } },
      select: { id: true, contributionId: true, status: true, researcherSubject: true, expiresAt: true },
    });
    if (!grant) return "missing" as const;
    if (decision !== "withdraw" && grant.expiresAt <= new Date()) return "conflict" as const;
    const allowed: Record<typeof decision, string[]> = {
      approve: ["REQUESTED"], deny: ["REQUESTED"], withdraw: ["PENDING_POLICY", "ACTIVE"],
    };
    if (!allowed[decision].includes(grant.status)) return "conflict" as const;
    const status = decision === "approve" ? "PENDING_POLICY" : decision === "deny" ? "DENIED" : "WITHDRAWN";
    await db.consentGrant.update({
      where: { id: grant.id },
      data: { status, withdrawnAt: decision === "withdraw" ? new Date() : null, ...(decision === "withdraw" ? { signedPolicy: null, ownerWritePolicy: null, sharedCiphertext: null } : {}) },
    });
    const action = decision === "approve" ? "CONSENT_APPROVED_AWAITING_TIDE_POLICY" : decision === "deny" ? "CONSENT_DENIED" : "CONSENT_WITHDRAWN";
    await db.auditEvent.create({ data: { actor: ownerSubject, action, resourceId: grant.contributionId, details: { grantId: grant.id, researcherSubject: grant.researcherSubject } } });
    return status;
  });
}

export async function attachConsentPolicies(adminSubject: string, grantId: string, signedPolicy: string, ownerWritePolicy: string) {
  return getDb().$transaction(async (db) => {
    const grant = await db.consentGrant.findFirst({ where: { id: grantId }, select: { id: true, contributionId: true, researcherSubject: true, researcherTideKey: true, status: true, expiresAt: true } });
    if (!grant || grant.status !== "PENDING_POLICY" || grant.expiresAt <= new Date()) return null;
    await db.consentGrant.update({ where: { id: grant.id }, data: { signedPolicy, ownerWritePolicy } });
    await db.auditEvent.create({ data: { actor: adminSubject, action: "TIDE_POLICIES_ATTACHED", resourceId: grant.contributionId, details: { grantId: grant.id, researcherSubject: grant.researcherSubject, expiresAt: grant.expiresAt.toISOString() } } });
    return { id: grant.id, contributionId: grant.contributionId };
  });
}

export async function saveSharedCiphertext(ownerSubject: string, grantId: string, ciphertext: string) {
  return getDb().$transaction(async (db) => {
    const grant = await db.consentGrant.findFirst({
      where: { id: grantId, status: "PENDING_POLICY", expiresAt: { gt: new Date() }, contribution: { participantSubject: ownerSubject, studyId: STUDY.id }, NOT: [{ signedPolicy: null }, { ownerWritePolicy: null }] },
      select: { id: true, contributionId: true },
    });
    if (!grant) return null;
    const updated = await db.consentGrant.updateMany({ where: { id: grant.id, status: "PENDING_POLICY", expiresAt: { gt: new Date() } }, data: { sharedCiphertext: ciphertext, status: "ACTIVE" } });
    if (!updated.count) return null;
    await db.auditEvent.create({ data: { actor: ownerSubject, action: "SHARED_CIPHERTEXT_SAVED", resourceId: grant.contributionId, details: { grantId: grant.id } } });
    return { id: grant.id };
  });
}

export async function getResearcherGrant(researcherSubject: string, grantId: string) {
  const grant = await getDb().consentGrant.findFirst({
    where: { id: grantId, researcherSubject, status: "ACTIVE", expiresAt: { gt: new Date() }, signedPolicy: { not: null }, sharedCiphertext: { not: null } },
    select: { id: true, contributionId: true, purpose: true, expiresAt: true, signedPolicy: true, sharedCiphertext: true },
  });
  if (!grant) return null;
  await getDb().auditEvent.create({ data: { actor: researcherSubject, action: "SHARED_CIPHERTEXT_DELIVERED", resourceId: grant.contributionId, details: { grantId: grant.id } } });
  return grant;
}

export async function getOwnerShareMaterials(ownerSubject: string, grantId: string) {
  return getDb().consentGrant.findFirst({
    where: { id: grantId, status: "PENDING_POLICY", expiresAt: { gt: new Date() }, contribution: { participantSubject: ownerSubject }, signedPolicy: { not: null }, ownerWritePolicy: { not: null } },
    select: { id: true, contributionId: true, ownerWritePolicy: true, contribution: { select: { ciphertext: true, encryptionTag: true } } },
  });
}

export async function getConsentPolicyContext(grantId: string) {
  return getDb().consentGrant.findFirst({
    where: { id: grantId },
    select: { id: true, contributionId: true, researcherTideKey: true, expiresAt: true, status: true, contribution: { select: { participantTideKey: true } } },
  });
}

export async function listAuditHistory(ownerSubject: string) {
  return getDb().auditEvent.findMany({
    where: { resourceId: { in: (await getDb().contribution.findMany({ where: { participantSubject: ownerSubject }, select: { id: true } })).map((r) => r.id) } },
    orderBy: { createdAt: "desc" }, take: 200,
  });
}
