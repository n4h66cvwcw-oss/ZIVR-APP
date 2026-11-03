import assert from "node:assert/strict";
import test from "node:test";
import {
  ZivrAgentClient,
  ZivrApiError,
  ZivrScopeError,
  loadZivrConfig,
  resolveAgentUrl,
  type FetchLike,
} from "./client.js";
import { mediaFromFile } from "./media.js";
import { verifyWebhookSignature, webhookSignature } from "./webhook.js";

const KEY = `zivr_agent_${"a".repeat(24)}`;
const AGENT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SCOPES = ["messages:send", "messages:read", "media:send", "chats:list"];
const PEER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const TINY_PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

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

test("resolveAgentUrl accepts the host root and the /api prefix once", () => {
  assert.equal(resolveAgentUrl("https://api.zivrapp.com", "agent/token"), "https://api.zivrapp.com/v1/agent/token");
  assert.equal(resolveAgentUrl("https://api.zivrapp.com/api/v1", "agent/messages"), "https://api.zivrapp.com/api/v1/agent/messages");
  assert.equal(resolveAgentUrl("http://127.0.0.1:8080", "agent/events"), "http://127.0.0.1:8080/v1/agent/events");
  assert.throws(() => resolveAgentUrl("ftp://api.zivrapp.com", "agent/token"), /http/);
  assert.throws(() => resolveAgentUrl("https://user:pass@api.zivrapp.com", "agent/token"), /credentials/);
});

test("the client exchanges the agent key once and refreshes near expiry", async () => {
  let now = 1_000_000;
  const calls: string[] = [];
  const fetchImpl: FetchLike = async (url, init) => {
    calls.push(`${init?.method} ${url}`);
    if (url.endsWith("/agent/token")) {
      assert.equal(header(init, "authorization"), undefined);
      assert.deepEqual(JSON.parse(String(init?.body)), { apiKey: KEY });
      return jsonResponse(tokenBody(calls.length === 1 ? "jwt-1" : "jwt-2"));
    }
    assert.equal(header(init, "authorization"), `Bearer ${calls.filter((call) => call.includes("/agent/token")).length === 1 ? "jwt-1" : "jwt-2"}`);
    return jsonResponse({ chats: [] });
  };
  const client = new ZivrAgentClient({ apiKey: KEY, fetch: fetchImpl, now: () => now });
  assert.deepEqual(await client.listChats(), []);
  assert.deepEqual(await client.listChats(), []);
  assert.equal(calls.filter((call) => call.endsWith("/agent/token")).length, 1);
  now += 3600 * 1000 - 30_000;
  assert.deepEqual(await client.listChats(), []);
  assert.equal(calls.filter((call) => call.endsWith("/agent/token")).length, 2);
});

test("a rejected token surfaces the API error and a missing scope fails before the call", async () => {
  let tokenCalls = 0;
  const fetchImpl: FetchLike = async (url) => {
    if (url.endsWith("/agent/token")) {
      tokenCalls += 1;
      return jsonResponse({ error: "Unknown API key", code: "auth" }, 401);
    }
    return jsonResponse({ chats: [] });
  };
  const client = new ZivrAgentClient({ apiKey: KEY, fetch: fetchImpl });
  await assert.rejects(() => client.listChats(), (err: unknown) => err instanceof ZivrApiError && err.status === 401 && err.code === "auth");
  await assert.rejects(() => client.listChats(), (err: unknown) => err instanceof ZivrApiError && err.status === 401);
  assert.equal(tokenCalls, 2);
  const token = { ...tokenBody(), scopes: ["messages:read"] };
  const scoped: FetchLike = async (url) => url.endsWith("/agent/token") ? jsonResponse(token) : jsonResponse({});
  const scopedClient = new ZivrAgentClient({ apiKey: KEY, fetch: scoped });
  await assert.rejects(() => scopedClient.sendMessage({ peerId: PEER, text: "hi", clientId: "c1" }), ZivrScopeError);
});

test("send posts the bearer token and keeps one attachment", async () => {
  const fetchImpl: FetchLike = async (url, init) => {
    if (url.endsWith("/agent/token")) return jsonResponse(tokenBody());
    assert.equal(url, "https://api.zivrapp.com/v1/agent/messages");
    assert.equal(header(init, "authorization"), "Bearer jwt-1");
    const body = JSON.parse(String(init?.body)) as { peerId: string; media: { kind: string; dataUrl: string } };
    assert.equal(body.peerId, PEER);
    assert.equal(body.media.kind, "image");
    assert.equal(body.media.dataUrl, TINY_PNG);
    return jsonResponse({ message: { id: "m1", chatId: "chat-1", type: "image" } }, 201);
  };
  const client = new ZivrAgentClient({ apiKey: KEY, fetch: fetchImpl });
  const sent = await client.sendMessage({
    peerId: PEER,
    text: "outline",
    clientId: "c1",
    media: { kind: "image", mimeType: "image/png", dataUrl: TINY_PNG, security: "none" },
  });
  assert.equal(sent.status, 201);
});

test("events keep nextSince and a 429 exposes Retry-After", async () => {
  const fetchImpl: FetchLike = async (url, init) => {
    if (url.endsWith("/agent/token")) return jsonResponse(tokenBody());
    if (url.includes("/agent/events")) {
      assert.equal(new URL(url).searchParams.get("since"), "40");
      return jsonResponse({
        events: [{ type: "message.created", message: { id: "2", senderId: PEER, text: "got it" } }],
        nextSince: 50,
      });
    }
    return jsonResponse({ error: "slow down", code: "rate" }, 429, { "retry-after": "12" });
  };
  const client = new ZivrAgentClient({ apiKey: KEY, fetch: fetchImpl });
  const page = await client.listEvents(40);
  assert.equal(page.nextSince, 50);
  assert.equal(page.events[0]?.message?.["text"], "got it");
  await assert.rejects(
    () => client.sendMessage({ peerId: PEER, text: "again", clientId: "c2" }),
    (err: unknown) => err instanceof ZivrApiError && err.retryAfter === 12 && err.code === "rate",
  );
});

test("config accepts the environment and rejects a key that is not an agent key", () => {
  const config = loadZivrConfig({ ZIVR_API_KEY: KEY, ZIVR_API_BASE: "http://127.0.0.1:8080/api" });
  assert.equal(config.baseUrl, "http://127.0.0.1:8080/api");
  assert.throws(() => loadZivrConfig({ ZIVR_API_KEY: "sk-live" }), /zivr_agent_/);
  const fromFile = loadZivrConfig({ ZIVR_CONNECTOR_CONFIG: "/tmp/zivr.json" }, () => JSON.stringify({ apiKey: KEY }));
  assert.equal(fromFile.apiKey, KEY);
});

test("a local file becomes one allowed attachment", () => {
  const png = Buffer.from(TINY_PNG.split(",")[1] ?? "", "base64");
  const media = mediaFromFile("notes/outline.png", png);
  assert.equal(media.kind, "image");
  assert.throws(() => mediaFromFile("clip.mp4", Buffer.from("nope")), /not allowed/);
});

test("webhook signature is sha256 over the raw body", () => {
  const secret = "hook-secret";
  const body = JSON.stringify({ type: "message.created" });
  const header = webhookSignature(secret, body);
  assert.equal(verifyWebhookSignature(secret, body, header), true);
  assert.equal(verifyWebhookSignature(secret, body, "sha256=00"), false);
  assert.equal(verifyWebhookSignature(secret, body, undefined), false);
});
