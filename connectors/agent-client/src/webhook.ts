import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

/** Allowed clock skew for `x-zivr-timestamp`, in seconds. */
export const DEFAULT_WEBHOOK_TOLERANCE_SECONDS = 300;

/**
 * How long a delivery id is remembered.
 * A timestamp can be accepted from `tolerance` seconds early through `tolerance` seconds late,
 * so the cache has to outlive that whole span or a future-skewed delivery could be replayed
 * after an early observation expired.
 */
export const DEFAULT_WEBHOOK_CACHE_TTL_MS = (DEFAULT_WEBHOOK_TOLERANCE_SECONDS * 2 + 1) * 1000;

export const DEFAULT_WEBHOOK_CACHE_MAX = 1024;

const TIMESTAMP = /^(0|[1-9][0-9]{0,11})$/;
const DELIVERY_ID = /^[A-Za-z0-9_-]{1,128}$/;

/** Header value ZIVR sends as `x-zivr-signature` over the raw JSON body. */
export function webhookSignature(secret: string, rawBody: string | Buffer): string {
  return `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
}

/**
 * Header value ZIVR sends as `x-zivr-signature-v2`.
 * The signed bytes are `${timestamp}.${deliveryId}.` followed by the raw body.
 */
export function webhookReplaySignature(
  secret: string,
  timestamp: string,
  deliveryId: string,
  rawBody: string | Buffer,
): string {
  return `sha256=${createHmac("sha256", secret).update(`${timestamp}.${deliveryId}.`).update(rawBody).digest("hex")}`;
}

export type SignedWebhookDelivery = {
  signature: string;
  timestamp: string;
  deliveryId: string;
  replaySignature: string;
};

export function signWebhookDelivery(
  secret: string,
  rawBody: string | Buffer,
  options?: { timestamp?: string; deliveryId?: string; now?: number },
): SignedWebhookDelivery {
  const timestamp = options?.timestamp ?? String(Math.floor((options?.now ?? Date.now()) / 1000));
  const deliveryId = options?.deliveryId ?? randomUUID();
  return {
    signature: webhookSignature(secret, rawBody),
    timestamp,
    deliveryId,
    replaySignature: webhookReplaySignature(secret, timestamp, deliveryId, rawBody),
  };
}

/** Headers a receiver needs. Does not include `content-type`. */
export function webhookSignatureHeaders(signed: SignedWebhookDelivery): Record<string, string> {
  return {
    "x-zivr-signature": signed.signature,
    "x-zivr-timestamp": signed.timestamp,
    "x-zivr-delivery": signed.deliveryId,
    "x-zivr-signature-v2": signed.replaySignature,
  };
}

type CacheEntry = { expiresAt: number };

/**
 * Bounded memory of delivery ids. Expired entries are dropped, and the
 * least-recently seen id is dropped when `maxEntries` is exceeded.
 * Seeing an id again does not extend its expiry.
 */
export class WebhookDeliveryCache {
  private readonly entries = new Map<string, CacheEntry>();
  private readonly maxEntries: number;
  private readonly ttlMs: number;

  constructor(options?: { maxEntries?: number; ttlMs?: number }) {
    const maxEntries = options?.maxEntries ?? DEFAULT_WEBHOOK_CACHE_MAX;
    const ttlMs = options?.ttlMs ?? DEFAULT_WEBHOOK_CACHE_TTL_MS;
    this.maxEntries = Number.isFinite(maxEntries) && maxEntries >= 1 ? Math.floor(maxEntries) : DEFAULT_WEBHOOK_CACHE_MAX;
    this.ttlMs = Number.isFinite(ttlMs) && ttlMs >= 1 ? Math.floor(ttlMs) : DEFAULT_WEBHOOK_CACHE_TTL_MS;
  }

  /**
   * @returns `true` when `id` is new and was stored, `false` when it is a replay or not a delivery id.
   * `nowMs` is epoch milliseconds.
   */
  remember(id: string, nowMs: number): boolean {
    if (!DELIVERY_ID.test(id)) return false;
    this.purge(nowMs);
    const existing = this.entries.get(id);
    if (existing && existing.expiresAt >= nowMs) {
      this.entries.delete(id);
      this.entries.set(id, existing);
      return false;
    }
    this.entries.set(id, { expiresAt: nowMs + this.ttlMs });
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
    return this.entries.has(id);
  }

  private purge(nowMs: number): void {
    for (const [id, entry] of this.entries) {
      if (entry.expiresAt < nowMs) this.entries.delete(id);
    }
  }
}

export type WebhookVerifyOptions = {
  /**
   * Body HMAC only. Ignores `x-zivr-timestamp`, `x-zivr-delivery`, and `x-zivr-signature-v2`.
   * This is also the behavior when `options` is omitted.
   */
  legacy?: boolean;
  /** Allowed absolute skew in seconds. Default {@link DEFAULT_WEBHOOK_TOLERANCE_SECONDS}. */
  toleranceSeconds?: number;
  /** `x-zivr-timestamp`, unix seconds. */
  timestamp?: string | number;
  /** `x-zivr-delivery`. */
  deliveryId?: string;
  /** `x-zivr-signature-v2`. */
  replaySignature?: string;
  /** Epoch milliseconds. Default `Date.now()`. */
  now?: number;
  /** Required when `legacy` is not set. Replays of `deliveryId` return false. */
  seen?: WebhookDeliveryCache;
};

function signaturesMatch(expected: string, header: string | undefined): boolean {
  if (!header) return false;
  const expectedBuf = Buffer.from(expected);
  const actual = Buffer.from(header);
  if (expectedBuf.length !== actual.length) return false;
  return timingSafeEqual(expectedBuf, actual);
}

function timestampString(value: string | number | undefined): string | null {
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || value < 0) return null;
    return String(value);
  }
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return TIMESTAMP.test(trimmed) ? trimmed : null;
}

/**
 * Checks `x-zivr-signature` over the raw body.
 * Pass `options` without `legacy: true` to also require a signed timestamp inside the
 * tolerance window (default 5 minutes) and a delivery id the cache has not seen.
 */
export function verifyWebhookSignature(
  secret: string,
  rawBody: string | Buffer,
  header: string | undefined,
  options?: WebhookVerifyOptions,
): boolean {
  if (!secret || !signaturesMatch(webhookSignature(secret, rawBody), header)) return false;
  if (!options || options.legacy) return true;
  const tolerance = options.toleranceSeconds ?? DEFAULT_WEBHOOK_TOLERANCE_SECONDS;
  if (!Number.isFinite(tolerance) || tolerance < 0) return false;
  const timestamp = timestampString(options.timestamp);
  const deliveryId = typeof options.deliveryId === "string" ? options.deliveryId.trim() : "";
  if (!timestamp || !DELIVERY_ID.test(deliveryId)) return false;
  if (!signaturesMatch(webhookReplaySignature(secret, timestamp, deliveryId, rawBody), options.replaySignature)) {
    return false;
  }
  const nowMs = options.now ?? Date.now();
  if (!Number.isFinite(nowMs)) return false;
  const skew = Math.abs(Math.floor(nowMs / 1000) - Number(timestamp));
  if (skew > tolerance) return false;
  if (!options.seen) return false;
  return options.seen.remember(deliveryId, nowMs);
}
