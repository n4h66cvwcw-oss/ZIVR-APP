import assert from "node:assert/strict";
import test from "node:test";
import {
  ZivrAgentClient,
  ZivrApiError,
  type FetchLike,
} from "./client.js";
import { mediaFromFile } from "./media.js";
import { verifyWebhookSignature, webhookSignature } from "./webhook.js";

const KEY = `zivr_agent_${"a".repeat(24)}`;
const AGENT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PEER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const SCOPES = ["messages:send", "messages:read", "media:send", "chats:list"];
const TINY_PDF = Buffer.from("JVBERi0xLjEKJcKlwrE=", "base64");

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

function header(init: RequestInit | undefined, name: string): string | undefined {
  const headers = init?.headers;
  if (!headers || headers instanceof Headers || Array.isArray(headers)) return undefined;
  const value = headers[name];
  return typeof value === "string" ? value : undefined;
}

function tokenBody(accessToken = "jwt-1", expiresIn = 3600) {
  return { accessToken, tokenType: "Bearer", expiresIn, agentUserId: AGENT, scopes: SCOPES };
}

test("a failed refresh keeps a token that has not expired yet", async () => {
  let now = 1_000_000;
  let tokenCalls = 0;
  const fetchImpl: FetchLike = async (url, init) => {
    if (url.endsWith("/agent/token")) {
      tokenCalls += 1;
      if (tokenCalls === 1) return jsonResponse(tokenBody("jwt-1", 3600));
      return jsonResponse({ error: "upstream", code: "upstream" }, 503);
    }
    assert.equal(header(init, "authorization"), "Bearer jwt-1");
    assert.equal(JSON.stringify(init?.body ?? "").includes(KEY), false);
    return jsonResponse({ chats: [{ id: "chat-1" }] });
  };
  const client = new ZivrAgentClient({ apiKey: KEY, fetch: fetchImpl, now: () => now });
  assert.deepEqual(await client.listChats(), [{ id: "chat-1" }]);
  now += 3600 * 1000 - 30_000;
  assert.deepEqual(await client.listChats(), [{ id: "chat-1" }]);
  assert.equal(tokenCalls, 2);
});

test("maps 401, 403, and 429 and does not loop on a second 401", async () => {
  const cases = [
    { status: 401, code: "auth", error: "Agent token was revoked", calls: 4 },
    { status: 403, code: "paused", error: "This profile is paused", calls: 2 },
    { status: 403, code: "scope", error: "Missing scope", calls: 2 },
    { status: 403, code: "cold_dm", error: "That agent has a different owner", calls: 2 },
    { status: 429, code: "rate_limited", error: "This profile reached the daily file limit", calls: 2, retryAfter: 120 },
  ] as const;
  for (const item of cases) {
    let calls = 0;
    const fetchImpl: FetchLike = async (url) => {
      calls += 1;
      if (url.endsWith("/agent/token")) return jsonResponse(tokenBody());
      const headers: Record<string, string> = {};
      if ("retryAfter" in item) headers["retry-after"] = String(item.retryAfter);
      return jsonResponse({ error: item.error, code: item.code }, item.status, headers);
    };
    const client = new ZivrAgentClient({ apiKey: KEY, fetch: fetchImpl, now: () => 5_000 });
    await assert.rejects(
      () => client.listChats(),
      (err: unknown) => err instanceof ZivrApiError
        && err.status === item.status
        && err.code === item.code
        && err.message === item.error
        && err.retryAfter === ("retryAfter" in item ? item.retryAfter : undefined),
    );
    assert.equal(calls, item.calls);
  }
});

test("events keep a missing cursor and a file send posts one attachment", async () => {
  const bodies: unknown[] = [];
  const fetchImpl: FetchLike = async (url, init) => {
    if (url.endsWith("/agent/token")) return jsonResponse(tokenBody());
    if (url.includes("/agent/events")) {
      assert.equal(new URL(url).searchParams.get("since"), "15");
      return jsonResponse({
        events: [
          { type: "message.created", message: { id: "1", senderId: PEER, createdAt: 20 } },
          { type: "not-a-message" },
        ],
      });
    }
    bodies.push(JSON.parse(String(init?.body)));
    assert.equal(header(init, "authorization"), "Bearer jwt-1");
    return jsonResponse({ message: { id: "m1", chatId: "chat-1", type: "file" } }, 201);
  };
  const client = new ZivrAgentClient({ apiKey: KEY, fetch: fetchImpl, now: () => 5_000 });
  const page = await client.listEvents(15);
  assert.equal(page.nextSince, 15);
  assert.equal(page.events.length, 2);
  assert.equal(page.events[1]?.message, undefined);
  await assert.rejects(() => client.listEvents(Number.NaN), (err: unknown) => err instanceof ZivrApiError && err.status === 400);
  const media = mediaFromFile("notes/outline.pdf", TINY_PDF);
  const sent = await client.sendMessage({
    peerId: PEER,
    text: "outline",
    clientId: "file-1",
    media,
  });
  assert.equal(sent.status, 201);
  assert.deepEqual(bodies[0], {
    peerId: PEER,
    text: "outline",
    clientId: "file-1",
    media: {
      kind: "file",
      mimeType: "application/pdf",
      dataUrl: `data:application/pdf;base64,${TINY_PDF.toString("base64")}`,
      fileName: "outline.pdf",
    },
  });
  assert.equal(JSON.stringify(bodies[0]).includes(KEY), false);
});

test("webhook HMAC accepts the raw body and rejects a bad signature or a rewritten timestamp", () => {
  const secret = "hook-secret";
  const createdAt = 1_730_000_000_000;
  const body = JSON.stringify({ type: "message.created", createdAt });
  const signature = webhookSignature(secret, body);
  assert.equal(verifyWebhookSignature(secret, body, signature), true);
  assert.equal(verifyWebhookSignature(secret, Buffer.from(body), signature), true);
  assert.equal(verifyWebhookSignature(secret, body, signature), true);
  assert.equal(verifyWebhookSignature(secret, body, "sha256=00"), false);
  assert.equal(verifyWebhookSignature(secret, body, signature.toUpperCase()), false);
  assert.equal(verifyWebhookSignature("other-secret", body, signature), false);
  assert.equal(verifyWebhookSignature("", body, signature), false);
  const rewritten = body.replace(String(createdAt), "1000");
  assert.equal(verifyWebhookSignature(secret, rewritten, signature), false);
  assert.equal(verifyWebhookSignature(secret, rewritten, webhookSignature(secret, rewritten)), true);
});
