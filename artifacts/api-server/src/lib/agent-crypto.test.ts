import assert from "node:assert/strict";
import test from "node:test";

process.env["SESSION_SECRET"] ??= "unit-test-session-secret";

import { signToken, verifyToken } from "./auth.ts";
import { createHmac } from "node:crypto";
import {
  generateApiKey,
  hashApiKey,
  openSecret,
  sealSecret,
  signAgentToken,
  signWebhookBody,
  signWebhookReplay,
  verifyAgentToken,
  webhookRequestHeaders,
} from "./agent-crypto.ts";

const agentId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ownerId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const keyId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

test("agent JWTs round-trip and are not session tokens", () => {
  const token = signAgentToken({
    sub: agentId,
    owner: ownerId,
    scopes: ["messages:send", "calendar:propose"],
    keyId,
  });
  const claims = verifyAgentToken(token);
  assert.ok(claims);
  assert.equal(claims.sub, agentId);
  assert.equal(claims.owner, ownerId);
  assert.deepEqual(claims.scopes, ["messages:send", "calendar:propose"]);
  assert.equal(verifyAgentToken(`${token}x`), null);

  assert.equal(verifyToken(token), null);
  const session = signToken(ownerId);
  assert.equal(verifyToken(session), ownerId);
  assert.equal(verifyAgentToken(session), null);
  assert.equal(token.includes(process.env["SESSION_SECRET"] ?? "missing"), false);
});

test("expired agent JWTs are rejected", () => {
  const token = signAgentToken({
    sub: agentId,
    owner: ownerId,
    scopes: ["messages:read"],
    keyId,
  }, Date.now() - 2 * 60 * 60 * 1000);
  assert.equal(verifyAgentToken(token), null);
});

test("webhook deliveries sign the timestamp and keep the body HMAC", () => {
  const secret = "hook-secret";
  const body = JSON.stringify({ type: "message.created" });
  const nowMs = 1_700_000_000_000;
  const headers = webhookRequestHeaders(secret, body, nowMs);
  assert.equal(headers["content-type"], "application/json");
  assert.equal(headers["x-zivr-timestamp"], "1700000000");
  assert.equal(headers["x-zivr-signature"], signWebhookBody(secret, body));
  assert.equal(
    headers["x-zivr-signature"],
    `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`,
  );
  const deliveryId = headers["x-zivr-delivery"] ?? "";
  assert.match(deliveryId, /^[0-9a-f-]{36}$/);
  assert.equal(headers["x-zivr-signature-v2"], signWebhookReplay(secret, "1700000000", deliveryId, body));
  assert.notEqual(signWebhookReplay(secret, "1700000001", deliveryId, body), headers["x-zivr-signature-v2"]);
  assert.notEqual(signWebhookReplay(secret, "1700000000", `${deliveryId}x`, body), headers["x-zivr-signature-v2"]);
});

test("api keys are hashed and webhook secrets round-trip sealed", () => {
  const minted = generateApiKey();
  assert.equal(minted.apiKey.startsWith("zivr_agent_"), true);
  assert.equal(minted.hash, hashApiKey(minted.apiKey));
  assert.equal(minted.apiKey.includes(minted.hash), false);
  const sealed = sealSecret("hook-secret");
  assert.equal(sealed.includes("hook-secret"), false);
  assert.equal(openSecret(sealed), "hook-secret");
  assert.equal(openSecret("nope"), null);
});
