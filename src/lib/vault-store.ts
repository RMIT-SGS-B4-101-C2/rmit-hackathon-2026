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

export async function createRecord(subject: string, ciphertext: string) {
  return getDb().$transaction(async (db) => {
    await db.study.upsert({ where: { id: STUDY.id }, update: {}, create: STUDY });
    const record = await db.contribution.create({
      data: { participantSubject: subject, studyId: STUDY.id, ciphertext, encryptionTag: ENCRYPTION_TAG },
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
