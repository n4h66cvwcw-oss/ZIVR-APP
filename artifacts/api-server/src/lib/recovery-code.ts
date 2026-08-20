import crypto from "crypto";

export function createRecoveryCode(): { code: string; hash: string } {
  const code = crypto.randomBytes(18).toString("base64url");
  return { code, hash: hashRecoveryCode(code) };
}

export function hashRecoveryCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}