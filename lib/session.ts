import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { SessionUser } from "@/lib/types";
import { findSessionUser } from "@/lib/db";

const COOKIE_NAME = "ika_session";
const SESSION_AGE_SECONDS = 60 * 60 * 12;

type SessionPayload = {
  userId: number;
  expiresAt: number;
};

type StoredSessionPayload = {
  userId: number | string;
  expiresAt: number;
};

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) {
    throw new Error("SESSION_SECRET minimal 32 karakter dan wajib dikonfigurasi.");
  }
  return value;
}

function sign(value: string) {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

function encode(payload: SessionPayload) {
  const value = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${value}.${sign(value)}`;
}

function decode(token: string): SessionPayload | null {
  const [value, signature] = token.split(".");
  if (!value || !signature) return null;
  const expected = Buffer.from(sign(value));
  const supplied = Buffer.from(signature);
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;

  try {
    const stored = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as StoredSessionPayload;
    const userId = Number(stored.userId);
    if (!Number.isSafeInteger(userId) || userId <= 0 || stored.expiresAt <= Date.now()) return null;
    return { userId, expiresAt: stored.expiresAt };
  } catch {
    return null;
  }
}

function isSecureRequest(request: Request) {
  const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  return (forwardedProtocol || new URL(request.url).protocol.replace(":", "")) === "https";
}

export async function createSession(userId: number, request: Request) {
  const cookieStore = await cookies();
  cookieStore.set(
    COOKIE_NAME,
    encode({ userId, expiresAt: Date.now() + SESSION_AGE_SECONDS * 1000 }),
    {
      httpOnly: true,
      secure: isSecureRequest(request),
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_AGE_SECONDS
    }
  );
}

export async function clearSession(request: Request) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: isSecureRequest(request),
    sameSite: "lax",
    path: "/",
    maxAge: 0
  });
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const payload = decode(token);
  if (!payload) return null;
  return findSessionUser(payload.userId);
}

export function isAdmin(user: SessionUser | null) {
  return user?.role === "Admin";
}
