import { z } from "zod";
import { enrollAndVerifyLegacyFace, getFaceVerificationRecord } from "@/lib/db";
import { encryptFaceDescriptor, normalizeFaceDescriptor, validateFaceEvidence } from "@/lib/face";
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

    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return jsonError("Data pemindaian wajah tidak valid.");
    const descriptor = normalizeFaceDescriptor(parsed.data.embedding);
    if (!descriptor) return jsonError("Descriptor wajah tidak valid. Ulangi pemindaian.");

    const record = await getFaceVerificationRecord(session.id);
    if (!record) return jsonError("Akun tidak ditemukan.", 404);
    if (record.faceTemplateEncrypted) {
      return jsonError("Wajah sudah terdaftar. Gunakan proses verifikasi wajah.", 409);
    }

    const liveness = validateFaceEvidence({
      token: parsed.data.challengeToken,
      evidence: parsed.data.evidence,
      mode: "enroll",
      userId: session.id
    });
    if (!liveness.valid) return jsonError(liveness.message);

    const saved = await enrollAndVerifyLegacyFace(session.id, encryptFaceDescriptor(descriptor));
    if (!saved) return jsonError("Wajah tidak dapat didaftarkan atau sudah pernah terdaftar.", 409);
    return Response.json({ ok: true, redirectTo: "/pemilihan" });
  } catch (error) {
    console.error("Legacy face enrollment failed:", error);
    return jsonError("Pendaftaran wajah tidak dapat diproses oleh server.", 500);
  }
}
