import assert from "node:assert/strict";
import test from "node:test";
import {
  ZivrAgentClient,
  ZivrApiError,
  ZivrScopeError,
  resolveAgentUrl,
  type FetchLike,
} from "./client.js";

const KEY = `zivr_agent_${"a".repeat(24)}`;
const AGENT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OWNER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const SCOPES = ["messages:send", "messages:read", "media:send", "chats:list", "calendar:read", "calendar:propose"];

const TINY_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const TINY_PDF = "data:application/pdf;base64,JVBERi0xLjEKJcKlwrE=";

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

function tokenBody(accessToken = "jwt-1", expiresIn = 3600, scopes = SCOPES) {
  return { accessToken, tokenType: "Bearer", expiresIn, agentUserId: AGENT, ownerUserId: OWNER, scopes };
}

test("resolveAgentUrl accepts the host root and the /api prefix once", () => {
  assert.equal(resolveAgentUrl("https://api.zivrapp.com", "agent/messages"), "https://api.zivrapp.com/v1/agent/messages");
  assert.equal(resolveAgentUrl("https://api.zivrapp.com/", "agent/messages"), "https://api.zivrapp.com/v1/agent/messages");
  assert.equal(resolveAgentUrl("https://api.zivrapp.com/api", "agent/chats"), "https://api.zivrapp.com/api/v1/agent/chats");
  assert.equal(resolveAgentUrl("https://api.zivrapp.com/api/", "agent/events"), "https://api.zivrapp.com/api/v1/agent/events");
  assert.equal(resolveAgentUrl("https://api.zivrapp.com/api/v1", "agent/token"), "https://api.zivrapp.com/api/v1/agent/token");
  assert.equal(resolveAgentUrl("https://api.zivrapp.com/v1/", "agent/token"), "https://api.zivrapp.com/v1/agent/token");
  assert.equal(resolveAgentUrl("http://127.0.0.1:8080", "agent/token"), "http://127.0.0.1:8080/v1/agent/token");
  assert.throws(() => resolveAgentUrl("ftp://api.zivrapp.com", "agent/token"), /http/);
  assert.throws(() => resolveAgentUrl("https://user:pass@api.zivrapp.com", "agent/token"), /credentials/);
});

test("exchanges the API key for a bearer token and reuses it until the refresh window", async () => {
  let now = 1_000_000;
  const calls: Array<{ url: string; init: RequestInit }> = [];
  let issued = 0;
  const fetchImpl: FetchLike = async (url, init) => {
    calls.push({ url, init });
    if (url.endsWith("/agent/token")) {
      issued += 1;
      assert.equal(header(init, "authorization"), undefined);
      assert.deepEqual(JSON.parse(String(init.body)), { apiKey: KEY });
      return jsonResponse(tokenBody(`jwt-${issued}`));
    }
    assert.equal(header(init, "authorization"), `Bearer jwt-${issued}`);
    return jsonResponse({ chats: [{ id: "chat-1" }] });
  };
  const client = new ZivrAgentClient({
    apiKey: KEY,
    baseUrl: "https://api.zivrapp.com/api",
    fetch: fetchImpl,
    now: () => now,
  });
  assert.deepEqual(await client.listChats(), [{ id: "chat-1" }]);
  now = 1_000_000 + 3600 * 1000 - 60_000 - 1;
  await client.listChats();
  assert.equal(calls.filter((call) => call.url.endsWith("/agent/token")).length, 1);
  assert.equal(calls[0]?.url, "https://api.zivrapp.com/api/v1/agent/token");
  now = 1_000_000 + 3600 * 1000 - 60_000;
  await client.listChats();
  assert.equal(calls.filter((call) => call.url.endsWith("/agent/token")).length, 2);
  assert.equal(header(calls.at(-1)?.init, "authorization"), "Bearer jwt-2");
});

test("shares one token exchange across overlapping calls", async () => {
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let tokenCalls = 0;
  const fetchImpl: FetchLike = async (url) => {
    if (url.endsWith("/agent/token")) {
      tokenCalls += 1;
      await gate;
      return jsonResponse(tokenBody());
    }
    return jsonResponse({ chats: [] });
  };
  const client = new ZivrAgentClient({ apiKey: KEY, fetch: fetchImpl, now: () => 0 });
  const pending = Promise.all([client.listChats(), client.listChats()]);
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(tokenCalls, 1);
  release();
  await pending;
});

test("retries once with a new JWT after a 401", async () => {
  let tokenCalls = 0;
  let messageCalls = 0;
  const fetchImpl: FetchLike = async (url, init) => {
    if (url.endsWith("/agent/token")) {
      tokenCalls += 1;
      return jsonResponse(tokenBody(tokenCalls === 1 ? "old" : "new"));
    }
    messageCalls += 1;
    if (header(init, "authorization") === "Bearer old") return jsonResponse({ error: "expired", code: "auth" }, 401);
    assert.equal(header(init, "authorization"), "Bearer new");
    return jsonResponse({ message: { id: "m1", chatId: "c1", type: "text" } });
  };
  const client = new ZivrAgentClient({ apiKey: KEY, fetch: fetchImpl, now: () => 5_000 });
  const sent = await client.sendMessage({ chatId: "c1", text: "hello", clientId: "send-1" });
  assert.equal(sent.status, 200);
  assert.equal(tokenCalls, 2);
  assert.equal(messageCalls, 2);
});

test("posts peer and chat sends, and queries events with since", async () => {
  const bodies: unknown[] = [];
  const urls: string[] = [];
  const fetchImpl: FetchLike = async (url, init) => {
    urls.push(url);
    if (url.endsWith("/agent/token")) return jsonResponse(tokenBody());
    if (init.body) bodies.push(JSON.parse(String(init.body)));
    if (url.includes("/agent/events")) return jsonResponse({ events: [], nextSince: 40 });
    if (url.includes("/calendar/proposals")) return jsonResponse({ proposal: { id: "p" }, message: { id: "m" } }, 201);
    return jsonResponse({ message: { id: "m" } });
  };
  const client = new ZivrAgentClient({ apiKey: KEY, baseUrl: "http://127.0.0.1:8080", fetch: fetchImpl, now: () => 10 });
  await client.sendMessage({
    peerId: AGENT,
    text: "",
    clientId: "img-1",
    media: { kind: "image", mimeType: "image/png", dataUrl: TINY_PNG, security: "none" },
  });
  await client.sendMessage({
    chatId: OWNER,
    text: "spec",
    clientId: "pdf-1",
    media: { kind: "file", mimeType: "application/pdf", dataUrl: TINY_PDF, fileName: "spec.pdf" },
  });
  const page = await client.listEvents(40);
  await client.proposeCalendar({
    chatId: OWNER,
    title: "Lunch",
    startsAt: 20,
    endsAt: 30,
    clientId: "cal-1",
    note: "downtown",
  });
  assert.deepEqual(bodies[0], {
    peerId: AGENT,
    text: "",
    clientId: "img-1",
    media: { kind: "image", mimeType: "image/png", dataUrl: TINY_PNG, security: "none" },
  });
  assert.equal((bodies[1] as { chatId?: string }).chatId, OWNER);
  assert.equal(urls.some((url) => url === "http://127.0.0.1:8080/v1/agent/events?since=40"), true);
  assert.equal(page.nextSince, 40);
  assert.equal((bodies[2] as { title?: string }).title, "Lunch");
});

test("stops before the API when the token is missing a scope", async () => {
  let posts = 0;
  const fetchImpl: FetchLike = async (url) => {
    if (url.endsWith("/agent/token")) {
      return jsonResponse(tokenBody("jwt", 3600, ["messages:send", "messages:read", "chats:list"]));
    }
    posts += 1;
    return jsonResponse({});
  };
  const client = new ZivrAgentClient({ apiKey: KEY, fetch: fetchImpl, now: () => 10 });
  await assert.rejects(
    () => client.sendMessage({
      chatId: OWNER,
      text: "pic",
      clientId: "m",
      media: { kind: "image", mimeType: "image/png", dataUrl: TINY_PNG, security: "none" },
    }),
    (err: unknown) => err instanceof ZivrScopeError && err.scope === "media:send",
  );
  await assert.rejects(
    () => client.proposeCalendar({ chatId: OWNER, title: "Lunch", startsAt: 1, endsAt: 2, clientId: "c" }),
    (err: unknown) => err instanceof ZivrScopeError && err.scope === "calendar:propose",
  );
  assert.equal(posts, 0);
});

test("surfaces API code and Retry-After", async () => {
  const fetchImpl: FetchLike = async (url) => {
    if (url.endsWith("/agent/token")) return jsonResponse(tokenBody());
    return jsonResponse(
      { error: "This profile reached the per-minute message limit", code: "rate_limited" },
      429,
      { "retry-after": "60" },
    );
  };
  const client = new ZivrAgentClient({ apiKey: KEY, fetch: fetchImpl, now: () => 10 });
  await assert.rejects(
    () => client.sendMessage({ chatId: OWNER, text: "hi", clientId: "c" }),
    (err: unknown) => err instanceof ZivrApiError && err.status === 429 && err.code === "rate_limited" && err.retryAfter === 60,
  );
});

test("does not cache a rejected API key", async () => {
  let tokenCalls = 0;
  const fetchImpl: FetchLike = async () => {
    tokenCalls += 1;
    return jsonResponse({ error: "API key is invalid", code: "auth" }, 401);
  };
  const client = new ZivrAgentClient({ apiKey: KEY, fetch: fetchImpl, now: () => 10 });
  await assert.rejects(() => client.scopes(), (err: unknown) => err instanceof ZivrApiError && err.status === 401);
  await assert.rejects(() => client.scopes());
  assert.equal(tokenCalls, 2);
});
