import type { NextFunction, Request, Response } from "express";
import { getAuthUserId } from "./auth";
import { queryOne } from "./db";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string | undefined | null): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export async function isUserBanned(userId: string): Promise<boolean> {
  if (!isUuid(userId)) return false;
  const row = await queryOne<{ banned: boolean }>(
    `SELECT banned FROM vm_users WHERE id = $1`,
    [userId],
  );
  return row?.banned === true;
}

/** Rejects a signed-in banned account. Requests without a token continue. */
export async function rejectBannedUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = getAuthUserId(req);
    if (!userId) {
      next();
      return;
    }
    if (await isUserBanned(userId)) {
      res.status(403).json({ error: "This account is suspended." });
      return;
    }
    next();
  } catch (err) {
    next(err);
  }
}

export async function requireAdmin(req: Request, res: Response): Promise<string | null> {
  const userId = getAuthUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Invalid or missing auth token" });
    return null;
  }
  const row = await queryOne<{ is_admin: boolean; banned: boolean }>(
    `SELECT is_admin, banned FROM vm_users WHERE id = $1`,
    [userId],
  );
  if (!row || row.banned) {
    res.status(403).json({ error: "This account is suspended." });
    return null;
  }
  if (!row.is_admin) {
    res.status(403).json({ error: "Admin only" });
    return null;
  }
  return userId;
}
