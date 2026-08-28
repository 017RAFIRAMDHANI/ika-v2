import { resetUserVote } from "@/lib/db";
import { getSessionUser, isAdmin } from "@/lib/session";
import { isSameOrigin, jsonError } from "@/lib/security";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return jsonError("Permintaan tidak valid.", 403);
  const session = await getSessionUser();
  if (!isAdmin(session)) return jsonError("Akses ditolak.", 403);
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) return jsonError("ID akun tidak valid.");
  const reset = await resetUserVote(id);
  if (!reset) return jsonError("Akun belum memilih atau tidak ditemukan.", 409);
  return Response.json({ ok: true });
}
