import crypto from "crypto";
import type { Request } from "express";

const SECRET = process.env["SESSION_SECRET"];
if (!SECRET) {
  throw new Error("SESSION_SECRET environment variable is required for auth tokens.");
}

function hmac(userId: string): string {
  return crypto.createHmac("sha256", SECRET as string).update(userId).digest("hex");
}

/** Issue a signed auth token for a user. Token format: `<userId>.<hmac>`. */
export function signToken(userId: string): string {
  return `${userId}.${hmac(userId)}`;
}

/** Verify a token and return the user id it belongs to, or null if invalid. */
export function verifyToken(token: string | undefined | null): string | null {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const userId = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = hmac(userId);
  if (sig.length !== expected.length) return null;
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  return userId;
}

/** Derive the authenticated user id from a request's X-Auth-Token header. */
export function getAuthUserId(req: Request): string | null {
  const header = req.header("x-auth-token");
  return verifyToken(header);
}
