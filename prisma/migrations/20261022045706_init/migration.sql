-- CreateEnum
CREATE TYPE "ConsentStatus" AS ENUM ('PENDING_POLICY', 'ACTIVE', 'WITHDRAWN');

-- CreateTable
CREATE TABLE "Study" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Study_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contribution" (
    "id" UUID NOT NULL,
    "participantSubject" TEXT NOT NULL,
    "studyId" UUID NOT NULL,
    "ciphertext" TEXT NOT NULL,
    "encryptionTag" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Contribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentGrant" (
    "id" UUID NOT NULL,
    "contributionId" UUID NOT NULL,
    "researcherSubject" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "status" "ConsentStatus" NOT NULL DEFAULT 'PENDING_POLICY',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "withdrawnAt" TIMESTAMP(3),
    "signedPolicy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsentGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" UUID NOT NULL,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Contribution_participantSubject_studyId_idx" ON "Contribution"("participantSubject", "studyId");

-- CreateIndex
CREATE INDEX "ConsentGrant_contributionId_researcherSubject_status_idx" ON "ConsentGrant"("contributionId", "researcherSubject", "status");

-- CreateIndex
CREATE INDEX "AuditEvent_resourceId_createdAt_idx" ON "AuditEvent"("resourceId", "createdAt");

-- AddForeignKey
ALTER TABLE "Contribution" ADD CONSTRAINT "Contribution_studyId_fkey" FOREIGN KEY ("studyId") REFERENCES "Study"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentGrant" ADD CONSTRAINT "ConsentGrant_contributionId_fkey" FOREIGN KEY ("contributionId") REFERENCES "Contribution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
