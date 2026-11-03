import { createHmac, timingSafeEqual } from "node:crypto";

/** Header value ZIVR sends as `x-zivr-signature` over the raw JSON body. */
export function webhookSignature(secret: string, rawBody: string | Buffer): string {
  return `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
}

export function verifyWebhookSignature(secret: string, rawBody: string | Buffer, header: string | undefined): boolean {
  if (!header) return false;
  const expected = Buffer.from(webhookSignature(secret, rawBody));
  const actual = Buffer.from(header);
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}
