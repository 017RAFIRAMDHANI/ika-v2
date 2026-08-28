import { z } from "zod";
import { createFaceChallenge } from "@/lib/face";
import { getSessionUser } from "@/lib/session";
import { isSameOrigin, jsonError } from "@/lib/security";

const modeSchema = z.enum(["register", "enroll", "verify"]);

export async function GET(request: Request) {
  try {
    if (!isSameOrigin(request)) return jsonError("Permintaan tidak valid.", 403);
    const mode = modeSchema.safeParse(new URL(request.url).searchParams.get("mode"));
    if (!mode.success) return jsonError("Mode verifikasi wajah tidak valid.");

    const session = await getSessionUser();
    if (mode.data !== "register" && !session) {
      return jsonError("Silakan login terlebih dahulu.", 401);
    }
    if (mode.data === "enroll" && session?.faceEnrolled) {
      return jsonError("Wajah akun ini sudah terdaftar.", 409);
    }
    if (mode.data === "verify" && !session?.faceEnrolled) {
      return jsonError("Wajah akun ini belum terdaftar.", 409);
    }

    const challenge = createFaceChallenge(mode.data, mode.data === "register" ? null : session?.id ?? null);
    return Response.json(
      { ok: true, ...challenge },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Face challenge failed:", error);
    return jsonError("Sesi verifikasi wajah tidak dapat dibuat. Periksa konfigurasi server.", 500);
  }
}
