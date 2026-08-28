import { z } from "zod";
import { getFaceVerificationRecord, markFaceVerified } from "@/lib/db";
import {
  decryptFaceDescriptor,
  FACE_MATCH_THRESHOLD,
  faceSimilarity,
  normalizeFaceDescriptor,
  validateFaceEvidence
} from "@/lib/face";
import { FACE_CHALLENGE_STEPS } from "@/lib/face-types";
import { getSessionUser } from "@/lib/session";
import { isSameOrigin, jsonError } from "@/lib/security";

const schema = z.object({
  embedding: z.array(z.number()).length(1024),
  challengeToken: z.string().min(20).max(4096),
  evidence: z.object({
    startedAt: z.number().int().positive(),
    completedAt: z.number().int().positive(),
    completedSteps: z.array(z.enum(FACE_CHALLENGE_STEPS)).length(FACE_CHALLENGE_STEPS.length),
    sampleCount: z.number().int().positive(),
    averageReal: z.number().min(0).max(1),
    averageLive: z.number().min(0).max(1)
  })
});

export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) return jsonError("Permintaan tidak valid.", 403);
    const session = await getSessionUser();
    if (!session) return jsonError("Silakan login terlebih dahulu.", 401);
    if (session.faceVerified) return Response.json({ ok: true, redirectTo: "/pemilihan" });

    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return jsonError("Data pemindaian wajah tidak valid.");
    const currentDescriptor = normalizeFaceDescriptor(parsed.data.embedding);
    if (!currentDescriptor) return jsonError("Descriptor wajah tidak valid. Ulangi pemindaian.");

    const liveness = validateFaceEvidence({
      token: parsed.data.challengeToken,
      evidence: parsed.data.evidence,
      mode: "verify",
      userId: session.id
    });
    if (!liveness.valid) return jsonError(liveness.message);

    const record = await getFaceVerificationRecord(session.id);
    if (!record?.faceTemplateEncrypted) {
      return jsonError("Data wajah akun belum tersedia. Lakukan aktivasi wajah terlebih dahulu.", 409);
    }
    const referenceDescriptor = decryptFaceDescriptor(record.faceTemplateEncrypted);
    const similarity = faceSimilarity(referenceDescriptor, currentDescriptor);
    if (similarity < FACE_MATCH_THRESHOLD) {
      return jsonError("Wajah tidak cocok dengan data akun. Pastikan akun dan pencahayaan sudah benar.", 401);
    }

    const saved = await markFaceVerified(session.id);
    if (!saved) return jsonError("Status verifikasi wajah tidak dapat disimpan.", 409);
    return Response.json({ ok: true, redirectTo: "/pemilihan" });
  } catch (error) {
    console.error("Face verification failed:", error);
    return jsonError("Verifikasi wajah tidak dapat diproses oleh server.", 500);
  }
}
