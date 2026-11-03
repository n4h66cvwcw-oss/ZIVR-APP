import crypto from "crypto";
import { AGENT_TOKEN_TTL_SECONDS, isAgentScope, type AgentScope } from "./agent-policy";

/**
 * Agent access tokens are HS256 JWTs signed with a key derived from
 * SESSION_SECRET. They are not session tokens: verifyToken() does not accept
 * them, and this module does not accept session tokens. The secret itself is
 * never returned to an agent.
 */

export type AgentTokenClaims = {
  sub: string;
  owner: string;
  scopes: AgentScope[];
  keyId: string;
  iat: number;
  exp: number;
};

function signingKey(): Buffer {
  const secret = process.env["SESSION_SECRET"];
  if (!secret) throw new Error("SESSION_SECRET environment variable is required for auth tokens.");
  return crypto.createHmac("sha256", secret).update("zivr-agent-jwt-v1").digest();
}

function webhookKey(): Buffer {
  const secret = process.env["SESSION_SECRET"];
  if (!secret) throw new Error("SESSION_SECRET environment variable is required for auth tokens.");
  return crypto.createHmac("sha256", secret).update("zivr-agent-webhook-v1").digest();
}

function b64url(value: Buffer | string): string {
  const buffer = typeof value === "string" ? Buffer.from(value) : value;
  return buffer.toString("base64url");
}

export function signAgentToken(
  claims: { sub: string; owner: string; scopes: AgentScope[]; keyId: string },
  nowMs = Date.now(),
  ttlSeconds = AGENT_TOKEN_TTL_SECONDS,
): string {
  const iat = Math.floor(nowMs / 1000);
  const exp = iat + ttlSeconds;
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify({
    sub: claims.sub,
    owner: claims.owner,
    scopes: claims.scopes,
    keyId: claims.keyId,
    iat,
    exp,
  }));
  const data = `${header}.${body}`;
  const sig = crypto.createHmac("sha256", signingKey()).update(data).digest("base64url");
  return `${data}.${sig}`;
}

export function verifyAgentToken(token: string | undefined | null, nowMs = Date.now()): AgentTokenClaims | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [headerPart, bodyPart, sigPart] = parts;
  if (!headerPart || !bodyPart || !sigPart) return null;
  let header: { alg?: unknown; typ?: unknown };
  try {
    header = JSON.parse(Buffer.from(headerPart, "base64url").toString("utf8")) as { alg?: unknown; typ?: unknown };
  } catch {
    return null;
  }
  if (header.alg !== "HS256" || header.typ !== "JWT") return null;
  const data = `${headerPart}.${bodyPart}`;
  const expected = crypto.createHmac("sha256", signingKey()).update(data).digest("base64url");
  const actual = Buffer.from(sigPart);
  const expectedBuf = Buffer.from(expected);
  if (actual.length !== expectedBuf.length) return null;
  if (!crypto.timingSafeEqual(actual, expectedBuf)) return null;
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(Buffer.from(bodyPart, "base64url").toString("utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
  if (typeof payload["sub"] !== "string" || typeof payload["owner"] !== "string" || typeof payload["keyId"] !== "string") {
    return null;
  }
  if (typeof payload["exp"] !== "number" || typeof payload["iat"] !== "number") return null;
  if (payload["exp"] * 1000 <= nowMs) return null;
  if (!Array.isArray(payload["scopes"]) || payload["scopes"].some((scope) => typeof scope !== "string" || !isAgentScope(scope))) {
    return null;
  }
  return {
    sub: payload["sub"],
    owner: payload["owner"],
    scopes: payload["scopes"] as AgentScope[],
    keyId: payload["keyId"],
    iat: payload["iat"],
    exp: payload["exp"],
  };
}

export function looksLikeApiKey(value: string): boolean {
  return /^zivr_agent_[A-Za-z0-9_-]{20,200}$/.test(value);
}

export function hashApiKey(apiKey: string): string {
  return crypto.createHash("sha256").update(apiKey).digest("hex");
}

export function generateApiKey(): { apiKey: string; hash: string; prefix: string } {
  const apiKey = `zivr_agent_${crypto.randomBytes(32).toString("base64url")}`;
  return { apiKey, hash: hashApiKey(apiKey), prefix: apiKey.slice(0, 20) };
}

export function sealSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", webhookKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64url")}.${tag.toString("base64url")}.${ciphertext.toString("base64url")}`;
}

export function openSecret(sealed: string): string | null {
  const parts = sealed.split(".");
  if (parts.length !== 3) return null;
  const [ivPart, tagPart, bodyPart] = parts;
  if (!ivPart || !tagPart || !bodyPart) return null;
  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", webhookKey(), Buffer.from(ivPart, "base64url"));
    decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
    const plain = Buffer.concat([
      decipher.update(Buffer.from(bodyPart, "base64url")),
      decipher.final(),
    ]);
    return plain.toString("utf8");
  } catch {
    return null;
  }
}

export function generateWebhookSecret(): { secret: string; sealed: string } {
  const secret = crypto.randomBytes(32).toString("base64url");
  return { secret, sealed: sealSecret(secret) };
}

export function signWebhookBody(secret: string, body: string): string {
  return `sha256=${crypto.createHmac("sha256", secret).update(body).digest("hex")}`;
}
