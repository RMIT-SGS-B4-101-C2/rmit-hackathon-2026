import { z } from "zod";

export const STUDY = {
  id: "ec1e3f05-6d62-40f1-a77d-e3b68b7dd501",
  title: "Sleep & study habits",
  description: "A demonstration study using fictional sleep and study-habit survey responses.",
} as const;
export const ENCRYPTION_TAG = "vault";

export const surveySchema = z.object({
  version: z.literal(1),
  synthetic: z.literal(true),
  sleepHours: z.number().min(0).max(24),
  studyHours: z.number().min(0).max(24),
  wellbeing: z.enum(["low", "fair", "good", "great"]),
  notes: z.string().trim().max(500),
}).strict();
export type Survey = z.infer<typeof surveySchema>;
export const SYNTHETIC_SURVEY: Survey = {
  version: 1, synthetic: true, sleepHours: 7.5, studyHours: 3,
  wellbeing: "good", notes: "Fictional participant: studies in the morning and sleeps on a regular schedule.",
};

// Only the ciphertext envelope crosses the upload boundary. Extra fields are rejected.
// This validates the transport shape, not whether a client actually used Tide to encrypt it.
export const uploadSchema = z.object({
  ciphertext: z.string().min(16).max(64 * 1024),
}).strict();
export const recordIdSchema = z.uuid();
export const consentRequestSchema = z.object({
  contributionId: z.uuid(),
  purpose: z.string().trim().min(12).max(500),
}).strict();
export const consentDecisionSchema = z.object({
  decision: z.enum(["approve", "deny", "withdraw"]),
}).strict();
export const signedPolicySchema = z.object({
  grantId: z.uuid(),
  readPolicy: z.string().min(32).max(32 * 1024),
  ownerWritePolicy: z.string().min(32).max(32 * 1024),
}).strict();

export interface EncryptedRecord {
  id: string;
  studyId: string;
  ciphertext: string;
  encryptionTag: string;
  createdAt: string;
}
