import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual
} from "node:crypto";
import { deflateRawSync, inflateRawSync } from "node:zlib";
import {
  FACE_CHALLENGE_STEPS,
  type FaceChallengeMode,
  type FaceChallengeStep,
  type FaceEvidence
} from "@/lib/face-types";

const FACE_DESCRIPTOR_LENGTH = 1024;
const CHALLENGE_AGE_MS = 2 * 60 * 1000;
const MIN_LIVENESS_SCORE = 0.5;
export const FACE_MATCH_THRESHOLD = 0.55;

type ChallengePayload = {
  mode: FaceChallengeMode;
  userId: number | null;
  steps: FaceChallengeStep[];
  issuedAt: number;
  expiresAt: number;
  nonce: string;
};

function dataSecret() {
  const value = process.env.FACE_DATA_SECRET;
  if (!value || value.length < 32) {
    throw new Error("FACE_DATA_SECRET minimal 32 karakter dan wajib dikonfigurasi.");
  }
  return value;
}

function encryptionKey() {
  return createHash("sha256").update(dataSecret()).digest();
}

function signChallenge(encodedPayload: string) {
  return createHmac("sha256", encryptionKey()).update(encodedPayload).digest("base64url");
}

function shuffledChallengeSteps(): FaceChallengeStep[] {
  const activeSteps: FaceChallengeStep[] = ["blink", "turn-left", "turn-right"];
  for (let index = activeSteps.length - 1; index > 0; index -= 1) {
    const swapWith = randomInt(index + 1);
    [activeSteps[index], activeSteps[swapWith]] = [activeSteps[swapWith], activeSteps[index]];
  }
  return [...activeSteps, "center"];
}

export function createFaceChallenge(mode: FaceChallengeMode, userId: number | null) {
  const issuedAt = Date.now();
  const payload: ChallengePayload = {
    mode,
    userId,
    steps: shuffledChallengeSteps(),
    issuedAt,
    expiresAt: issuedAt + CHALLENGE_AGE_MS,
    nonce: randomBytes(18).toString("base64url")
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return {
    token: `${encoded}.${signChallenge(encoded)}`,
    steps: payload.steps,
    expiresAt: payload.expiresAt
  };
}

function decodeChallenge(token: string): ChallengePayload | null {
  const [encoded, suppliedSignature] = token.split(".");
  if (!encoded || !suppliedSignature) return null;
  const expected = Buffer.from(signChallenge(encoded));
  const supplied = Buffer.from(suppliedSignature);
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as ChallengePayload;
    const validSteps = Array.isArray(payload.steps)
      && payload.steps.length === FACE_CHALLENGE_STEPS.length
      && payload.steps.every((step) => FACE_CHALLENGE_STEPS.includes(step));
    if (!validSteps || typeof payload.expiresAt !== "number" || typeof payload.issuedAt !== "number") return null;
    return payload;
  } catch {
    return null;
  }
}

export function validateFaceEvidence(input: {
  token: string;
  evidence: FaceEvidence;
  mode: FaceChallengeMode;
  userId: number | null;
}) {
  const challenge = decodeChallenge(input.token);
  if (!challenge || challenge.expiresAt < Date.now()) {
    return { valid: false, message: "Sesi verifikasi wajah kedaluwarsa. Ulangi pemindaian." } as const;
  }
  if (challenge.mode !== input.mode || challenge.userId !== input.userId) {
    return { valid: false, message: "Sesi verifikasi wajah tidak sesuai." } as const;
  }

  const evidence = input.evidence;
  const duration = evidence.completedAt - evidence.startedAt;
  const sameSteps = Array.isArray(evidence.completedSteps)
    && evidence.completedSteps.join("|") === challenge.steps.join("|");
  const validTimeline = evidence.startedAt >= challenge.issuedAt - 5000
    && evidence.completedAt <= challenge.expiresAt + 5000
    && duration >= 1000
    && duration <= CHALLENGE_AGE_MS;
  const validScores = Number.isFinite(evidence.averageReal)
    && Number.isFinite(evidence.averageLive)
    && evidence.averageReal >= MIN_LIVENESS_SCORE
    && evidence.averageLive >= MIN_LIVENESS_SCORE;
  const validSamples = Number.isInteger(evidence.sampleCount)
    && evidence.sampleCount >= FACE_CHALLENGE_STEPS.length
    && evidence.sampleCount <= 2000;

  if (!sameSteps || !validTimeline || !validScores || !validSamples) {
    return { valid: false, message: "Bukti liveness wajah tidak memenuhi persyaratan. Ulangi pemindaian." } as const;
  }
  return { valid: true, challenge } as const;
}

export function normalizeFaceDescriptor(value: unknown) {
  if (!Array.isArray(value) || value.length !== FACE_DESCRIPTOR_LENGTH) return null;
  const descriptor = value.map(Number);
  if (descriptor.some((item) => !Number.isFinite(item) || Math.abs(item) > 10)) return null;
  return descriptor.map((item) => Math.round(item * 1_000_000) / 1_000_000);
}

export function encryptFaceDescriptor(descriptor: number[]) {
  const normalized = normalizeFaceDescriptor(descriptor);
  if (!normalized) throw new Error("Descriptor wajah tidak valid.");
  const floatData = new Float32Array(normalized);
  const compressed = deflateRawSync(Buffer.from(floatData.buffer));
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(compressed),
    cipher.final()
  ]);
  const tag = cipher.getAuthTag();
  return `v2.${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptFaceDescriptor(value: string) {
  const [version, ivValue, tagValue, encryptedValue] = value.split(".");
  if (!(["v1", "v2"].includes(version)) || !ivValue || !tagValue || !encryptedValue) {
    throw new Error("Format data wajah terenkripsi tidak dikenali.");
  }
  try {
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivValue, "base64url"));
    decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedValue, "base64url")),
      decipher.final()
    ]);
    const rawDescriptor = version === "v2"
      ? (() => {
          const inflated = inflateRawSync(decrypted);
          if (inflated.byteLength !== FACE_DESCRIPTOR_LENGTH * Float32Array.BYTES_PER_ELEMENT) {
            throw new Error("Descriptor wajah tidak valid.");
          }
          return Array.from(new Float32Array(
            inflated.buffer.slice(inflated.byteOffset, inflated.byteOffset + inflated.byteLength)
          ));
        })()
      : JSON.parse(decrypted.toString("utf8"));
    const descriptor = normalizeFaceDescriptor(rawDescriptor);
    if (!descriptor) throw new Error("Descriptor wajah tidak valid.");
    return descriptor;
  } catch (error) {
    if (error instanceof Error && error.message === "Descriptor wajah tidak valid.") throw error;
    throw new Error("Data wajah tidak dapat dibuka. Pastikan FACE_DATA_SECRET sama dengan sistem asal.");
  }
}

export function faceSimilarity(first: number[], second: number[]) {
  if (first.length !== second.length || first.length !== FACE_DESCRIPTOR_LENGTH) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let index = 0; index < first.length; index += 1) {
    dotProduct += first[index] * second[index];
    normA += first[index] * first[index];
    normB += second[index] * second[index];
  }
  if (normA === 0 || normB === 0) return 0;
  const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  return Math.round(100 * Math.max(similarity, 0)) / 100;
}
