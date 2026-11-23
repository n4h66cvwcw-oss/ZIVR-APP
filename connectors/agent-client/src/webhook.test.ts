import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_WEBHOOK_TOLERANCE_SECONDS,
  WebhookDeliveryCache,
  signWebhookDelivery,
  verifyWebhookSignature,
  webhookReplaySignature,
  webhookSignature,
} from "./webhook.js";

const secret = "hook-secret";
const body = JSON.stringify({ type: "message.created", message: { id: "m1", createdAt: 1_000 } });
const nowSec = 1_700_000_000;
const nowMs = nowSec * 1000;

function replayOptions(
  overrides: {
    timestamp?: string;
    deliveryId?: string;
    replaySignature?: string;
    now?: number;
    seen?: WebhookDeliveryCache;
    toleranceSeconds?: number;
    legacy?: boolean;
    body?: string;
  } = {},
) {
  const payload = overrides.body ?? body;
  const signed = signWebhookDelivery(secret, payload, {
    timestamp: overrides.timestamp ?? String(nowSec),
    deliveryId: overrides.deliveryId ?? "delivery-1",
    now: nowMs,
  });
  return {
    payload,
    header: signed.signature,
    options: {
      timestamp: signed.timestamp,
      deliveryId: signed.deliveryId,
      replaySignature: overrides.replaySignature ?? signed.replaySignature,
      now: overrides.now ?? nowMs,
      seen: overrides.seen ?? new WebhookDeliveryCache(),
      ...(overrides.toleranceSeconds != null ? { toleranceSeconds: overrides.toleranceSeconds } : {}),
      ...(overrides.legacy ? { legacy: true } : {}),
    },
  };
}

test("a signed delivery inside the five-minute window is accepted once", () => {
  const seen = new WebhookDeliveryCache();
  const { payload, header, options } = replayOptions({ seen, deliveryId: "delivery-ok" });
  assert.equal(verifyWebhookSignature(secret, payload, header, options), true);
  assert.equal(header, webhookSignature(secret, payload));
  assert.equal(options.replaySignature, webhookReplaySignature(secret, options.timestamp, options.deliveryId, payload));
  assert.equal(DEFAULT_WEBHOOK_TOLERANCE_SECONDS, 300);
});

test("a delivery older than five minutes is rejected", () => {
  const stale = replayOptions({ timestamp: String(nowSec - 301) });
  assert.equal(verifyWebhookSignature(secret, stale.payload, stale.header, stale.options), false);
  const edge = replayOptions({ timestamp: String(nowSec - 300), deliveryId: "delivery-stale-edge" });
  assert.equal(verifyWebhookSignature(secret, edge.payload, edge.header, edge.options), true);
});

test("a delivery skewed more than five minutes into the future is rejected", () => {
  const future = replayOptions({ timestamp: String(nowSec + 301), deliveryId: "delivery-future" });
  assert.equal(verifyWebhookSignature(secret, future.payload, future.header, future.options), false);
  const edge = replayOptions({ timestamp: String(nowSec + 300), deliveryId: "delivery-future-edge" });
  assert.equal(verifyWebhookSignature(secret, edge.payload, edge.header, edge.options), true);
});

test("the same delivery id is rejected the second time", () => {
  const seen = new WebhookDeliveryCache();
  const first = replayOptions({ seen, deliveryId: "delivery-replay" });
  const second = replayOptions({ seen, deliveryId: "delivery-replay" });
  assert.equal(verifyWebhookSignature(secret, first.payload, first.header, first.options), true);
  assert.equal(verifyWebhookSignature(secret, second.payload, second.header, second.options), false);
});

test("legacy body-only verification still accepts a captured body", () => {
  const header = webhookSignature(secret, body);
  assert.equal(verifyWebhookSignature(secret, body, header), true);
  assert.equal(verifyWebhookSignature(secret, body, header), true);
  assert.equal(verifyWebhookSignature(secret, Buffer.from(body), header), true);
  const captured = replayOptions({ timestamp: String(nowSec - 86_400), legacy: true, deliveryId: "delivery-old" });
  assert.equal(verifyWebhookSignature(secret, captured.payload, captured.header, captured.options), true);
  assert.equal(verifyWebhookSignature(secret, body, "sha256=00"), false);
});

test("a rewritten timestamp or delivery id fails the v2 signature and does not consume the id", () => {
  const seen = new WebhookDeliveryCache();
  const signed = signWebhookDelivery(secret, body, { timestamp: String(nowSec), deliveryId: "delivery-tamper", now: nowMs });
  assert.equal(verifyWebhookSignature(secret, body, signed.signature, {
    timestamp: String(nowSec - 10),
    deliveryId: signed.deliveryId,
    replaySignature: signed.replaySignature,
    now: nowMs,
    seen,
  }), false);
  assert.equal(verifyWebhookSignature(secret, body, signed.signature, {
    timestamp: signed.timestamp,
    deliveryId: signed.deliveryId,
    replaySignature: signed.replaySignature,
    now: nowMs,
    seen,
  }), true);
});

test("the delivery cache drops the oldest id when it is full", () => {
  const seen = new WebhookDeliveryCache({ maxEntries: 2, ttlMs: 60_000 });
  for (const deliveryId of ["a", "b", "c"]) {
    const signed = replayOptions({ seen, deliveryId });
    assert.equal(verifyWebhookSignature(secret, signed.payload, signed.header, signed.options), true);
  }
  const evicted = replayOptions({ seen, deliveryId: "a" });
  assert.equal(verifyWebhookSignature(secret, evicted.payload, evicted.header, evicted.options), true);
  const kept = replayOptions({ seen, deliveryId: "c" });
  assert.equal(verifyWebhookSignature(secret, kept.payload, kept.header, kept.options), false);
});
