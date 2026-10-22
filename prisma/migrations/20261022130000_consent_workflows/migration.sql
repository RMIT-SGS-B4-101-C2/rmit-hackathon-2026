ALTER TYPE "ConsentStatus" ADD VALUE IF NOT EXISTS 'REQUESTED';
ALTER TYPE "ConsentStatus" ADD VALUE IF NOT EXISTS 'DENIED';

ALTER TABLE "ConsentGrant"
ADD COLUMN IF NOT EXISTS "researcherTideKey" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ConsentGrant" ALTER COLUMN "researcherTideKey" DROP DEFAULT;

ALTER TABLE "Contribution"
ADD COLUMN IF NOT EXISTS "participantTideKey" TEXT NOT NULL DEFAULT '';

ALTER TABLE "ConsentGrant"
ADD COLUMN IF NOT EXISTS "ownerWritePolicy" TEXT,
ADD COLUMN IF NOT EXISTS "sharedCiphertext" TEXT;

ALTER TABLE "AuditEvent"
ADD COLUMN IF NOT EXISTS "details" JSONB;

CREATE INDEX IF NOT EXISTS "ConsentGrant_researcherSubject_status_expiresAt_idx"
ON "ConsentGrant"("researcherSubject", "status", "expiresAt");
