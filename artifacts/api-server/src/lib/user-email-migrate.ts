import { query } from "./db";
import { logger } from "./logger";

type Query = <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<T[]>;

/**
 * vm_users.email (nullable) + case-insensitive uniqueness for non-empty values.
 * Idempotent; called from migrate() and lazily from the recover-email routes.
 */
export async function migrateUserEmail(run: Query = query): Promise<void> {
  await run(`
    ALTER TABLE vm_users
    ADD COLUMN IF NOT EXISTS email TEXT
  `);
  const duplicates = await run<{ ownerCount: number }>(`
    SELECT COUNT(*)::int AS "ownerCount"
      FROM vm_users
     WHERE email IS NOT NULL AND email <> ''
     GROUP BY lower(email)
    HAVING COUNT(*) > 1
  `);
  if (duplicates.length > 0) {
    logger.warn(
      { duplicateEmailCount: duplicates.length },
      "Duplicate vm_users emails detected; email uniqueness index deferred",
    );
    return;
  }
  await run(`
    CREATE UNIQUE INDEX IF NOT EXISTS vm_users_email_lower_unique
    ON vm_users (lower(email))
    WHERE email IS NOT NULL AND email <> ''
  `);
}

let ensured: Promise<void> | null = null;

export function ensureUserEmailSchema(): Promise<void> {
  if (!ensured) {
    ensured = migrateUserEmail().catch((error) => {
      ensured = null;
      throw error;
    });
  }
  return ensured;
}
