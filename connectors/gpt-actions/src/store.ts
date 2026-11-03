import { createHash, randomBytes } from "node:crypto";
import { MAX_AUTH_CODES, MAX_REFRESH_TOKENS } from "./limits.js";

export type AuthCodeRecord = {
  apiKey: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string | null;
  expiresAt: number;
};

export type RefreshRecord = {
  apiKey: string;
  clientId: string;
  expiresAt: number;
};

export type AuthStore = {
  saveCode(code: string, record: AuthCodeRecord, now: number): "ok" | "full";
  takeCode(code: string, now: number): AuthCodeRecord | null;
  saveRefresh(token: string, record: RefreshRecord, now: number): void;
  readRefresh(token: string, now: number): RefreshRecord | null;
  deleteRefresh(token: string): void;
};

function digest(value: string): string {
  return createHash("sha256").update(value).digest("base64url");
}

function dropExpired<T extends { expiresAt: number }>(map: Map<string, T>, now: number): void {
  for (const [key, record] of map) {
    if (record.expiresAt <= now) map.delete(key);
  }
}

/**
 * Process-local authorization codes and refresh tokens. The API key stays in
 * memory so a refresh can mint a new agent JWT. A restart drops both maps.
 */
export function createMemoryAuthStore(): AuthStore {
  const codes = new Map<string, AuthCodeRecord>();
  const refreshes = new Map<string, RefreshRecord>();

  return {
    saveCode(code, record, now) {
      dropExpired(codes, now);
      if (codes.size >= MAX_AUTH_CODES) return "full";
      codes.set(digest(code), record);
      return "ok";
    },
    takeCode(code, now) {
      const key = digest(code);
      const record = codes.get(key);
      if (!record) return null;
      codes.delete(key);
      if (record.expiresAt <= now) return null;
      return record;
    },
    saveRefresh(token, record, now) {
      const key = digest(token);
      refreshes.delete(key);
      dropExpired(refreshes, now);
      while (refreshes.size >= MAX_REFRESH_TOKENS) {
        const oldest = refreshes.keys().next().value;
        if (oldest == null) break;
        refreshes.delete(oldest);
      }
      refreshes.set(key, record);
    },
    readRefresh(token, now) {
      const key = digest(token);
      const record = refreshes.get(key);
      if (!record) return null;
      if (record.expiresAt <= now) {
        refreshes.delete(key);
        return null;
      }
      return record;
    },
    deleteRefresh(token) {
      refreshes.delete(digest(token));
    },
  };
}

export function randomSecret(prefix: string): string {
  return `${prefix}${randomBytes(32).toString("base64url")}`;
}
