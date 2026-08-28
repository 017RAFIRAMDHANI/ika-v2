import bcrypt from "bcryptjs";
import { z } from "zod";
import { createPublicVoter } from "@/lib/db";
import { encryptFaceDescriptor, normalizeFaceDescriptor, validateFaceEvidence } from "@/lib/face";
import { FACE_CHALLENGE_STEPS } from "@/lib/face-types";
import { validateRegistrationAccessToken } from "@/lib/registration-access";
import { isSameOrigin, jsonError } from "@/lib/security";

const currentYear = new Date().getUTCFullYear();
const faceEvidenceSchema = z.object({
  startedAt: z.number().int().positive(),
  completedAt: z.number().int().positive(),
  completedSteps: z.array(z.enum(FACE_CHALLENGE_STEPS)).length(FACE_CHALLENGE_STEPS.length),
  sampleCount: z.number().int().positive(),
  averageReal: z.number().min(0).max(1),
  averageLive: z.number().min(0).max(1)
});

const registrationSchema = z.object({
  accessToken: z.string().min(20).max(4096),
  userId: z.string().trim().min(5, "NPM/NIM minimal 5 karakter.").max(64)
    .regex(/^[A-Za-z0-9./-]+$/, "NPM/NIM hanya boleh berisi huruf, angka, titik, garis miring, atau tanda hubung."),
  displayName: z.string().trim().min(3, "Nama lengkap minimal 3 karakter.").max(255),
  email: z.string().trim().toLowerCase().email("Alamat email tidak valid.").max(320),
  whatsapp: z.string().trim().min(8, "Nomor WhatsApp minimal 8 digit.").max(32)
    .regex(/^\+?[0-9][0-9\s-]+$/, "Nomor WhatsApp tidak valid."),
  studyProgram: z.enum(["Administrasi Negara", "Administrasi Publik"]),
  cohort: z.string().trim().regex(/^\d{4}$/, "Angkatan harus terdiri dari 4 digit.")
    .refine((value) => Number(value) >= 1950 && Number(value) <= currentYear, "Tahun angkatan tidak valid."),
  graduationYear: z.union([
    z.literal(""),
    z.string().trim().regex(/^\d{4}$/, "Tahun lulus harus terdiri dari 4 digit.")
      .refine((value) => Number(value) >= 1950 && Number(value) <= currentYear + 1, "Tahun lulus tidak valid.")
  ]),
  domicile: z.string().trim().max(160).optional().default(""),
  password: z.string().min(8, "Password minimal 8 karakter.").max(255),
  confirmPassword: z.string().max(255),
  consent: z.literal(true, { error: "Persetujuan pemrosesan data biometrik wajib diberikan." }),
  website: z.string().max(0).optional().default(""),
  face: z.object({
    embedding: z.array(z.number()).length(1024),
    challengeToken: z.string().min(20).max(4096),
    evidence: faceEvidenceSchema
  })
}).refine((data) => data.password === data.confirmPassword, {
  path: ["confirmPassword"],
  message: "Konfirmasi password tidak sama."
});

export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) return jsonError("Permintaan tidak valid.", 403);
    const parsed = registrationSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Data pendaftaran tidak valid.");
    if (!validateRegistrationAccessToken(parsed.data.accessToken)) {
      return jsonError("Akses pendaftaran kedaluwarsa atau tidak valid. Masukkan kembali Kode Primary DPT.", 403);
    }

    const descriptor = normalizeFaceDescriptor(parsed.data.face.embedding);
    if (!descriptor) return jsonError("Descriptor wajah tidak valid. Ulangi pemindaian.");
    const liveness = validateFaceEvidence({
      token: parsed.data.face.challengeToken,
      evidence: parsed.data.face.evidence,
      mode: "register",
      userId: null
    });
    if (!liveness.valid) return jsonError(liveness.message);

    await createPublicVoter({
      userId: parsed.data.userId,
      displayName: parsed.data.displayName,
      email: parsed.data.email,
      whatsapp: parsed.data.whatsapp.replace(/[\s-]/g, ""),
      studyProgram: parsed.data.studyProgram,
      cohort: parsed.data.cohort,
      graduationYear: parsed.data.graduationYear || null,
      domicile: parsed.data.domicile || null,
      passwordHash: await bcrypt.hash(parsed.data.password, 12),
      faceTemplateEncrypted: encryptFaceDescriptor(descriptor)
    });

    return Response.json(
      { ok: true, message: "Pendaftaran DPT berhasil. Silakan masuk menggunakan NPM/NIM dan password Anda." },
      { status: 201, headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const databaseError = error as { code?: string; constraint?: string };
    if (databaseError.code === "23505") {
      const emailConflict = databaseError.constraint === "uq_users_email_ci";
      return jsonError(emailConflict ? "Email sudah digunakan oleh akun lain." : "NPM/NIM sudah terdaftar.", 409);
    }
    console.error("Public voter registration failed:", error);
    return jsonError("Pendaftaran tidak dapat diproses oleh server. Silakan coba lagi.", 500);
  }
}
