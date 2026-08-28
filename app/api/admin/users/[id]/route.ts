import bcrypt from "bcryptjs";
import { z } from "zod";
import { deleteAdminUser, updateAdminUser } from "@/lib/db";
import { getSessionUser, isAdmin } from "@/lib/session";
import { isSameOrigin, jsonError } from "@/lib/security";

const schema = z.object({
  userId: z.string().trim().min(1).max(255),
  displayName: z.string().trim().min(2).max(255),
  password: z.string().max(255).optional().default(""),
  role: z.enum(["Alumni", "Admin"])
});

function parseId(value: string) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return jsonError("Permintaan tidak valid.", 403);
  const session = await getSessionUser();
  if (!session || !isAdmin(session)) return jsonError("Akses ditolak.", 403);
  const id = parseId((await params).id);
  if (!id) return jsonError("ID akun tidak valid.");
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Data akun tidak valid.");
  if (parsed.data.password && parsed.data.password.length < 6) return jsonError("Password minimal 6 karakter.");

  try {
    const updated = await updateAdminUser(id, {
      userId: parsed.data.userId,
      displayName: parsed.data.displayName,
      role: parsed.data.role,
      passwordHash: parsed.data.password ? await bcrypt.hash(parsed.data.password, 12) : null
    });
    if (!updated) return jsonError("Akun tidak ditemukan.", 404);
    return Response.json({ ok: true });
  } catch {
    return jsonError("User ID sudah digunakan atau akun gagal diperbarui.", 409);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return jsonError("Permintaan tidak valid.", 403);
  const session = await getSessionUser();
  if (!session || !isAdmin(session)) return jsonError("Akses ditolak.", 403);
  const id = parseId((await params).id);
  if (!id) return jsonError("ID akun tidak valid.");
  if (id === session.id) return jsonError("Akun yang sedang digunakan tidak dapat dihapus.", 409);
  const deleted = await deleteAdminUser(id);
  if (!deleted) return jsonError("Akun tidak ditemukan.", 404);
  return Response.json({ ok: true });
}
