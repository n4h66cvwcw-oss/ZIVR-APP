import assert from "node:assert/strict";
import test from "node:test";
import {
  GptActionsClient,
  GptActionsError,
  exchangeAgentApiKey,
  inboundMessages,
  resolveAgentUrl,
  senderIdOf,
  type FetchLike,
} from "./client.js";
import { GPT_ACTION_MAX_CHARS } from "./limits.js";

const KEY = `zivr_agent_${"a".repeat(24)}`;
const JWT = "agent-jwt";
const AGENT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PEER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CHAT = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const TINY_PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
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
  return headers[name];
}

test("resolveAgentUrl accepts the host root and the /api prefix once", () => {
  assert.equal(resolveAgentUrl("https://api.zivrapp.com", "agent/messages"), "https://api.zivrapp.com/v1/agent/messages");
  assert.equal(resolveAgentUrl("https://api.zivrapp.com/api", "agent/events"), "https://api.zivrapp.com/api/v1/agent/events");
  assert.equal(resolveAgentUrl("https://api.zivrapp.com/api/v1", "agent/token"), "https://api.zivrapp.com/api/v1/agent/token");
  assert.throws(() => resolveAgentUrl("https://user:pass@api.zivrapp.com", "agent/token"), /credentials/);
});

test("exchangeAgentApiKey posts the pasted key and returns the agent JWT", async () => {
  const fetchImpl: FetchLike = async (url, init) => {
    assert.equal(url, "https://api.zivrapp.com/v1/agent/token");
    assert.deepEqual(JSON.parse(String(init?.body)), { apiKey: KEY });
    return jsonResponse({
      accessToken: JWT,
      tokenType: "Bearer",
      expiresIn: 3600,
      agentUserId: AGENT,
      scopes: ["messages:send", "messages:read"],
    });
  };
  const result = await exchangeAgentApiKey(KEY, { fetch: fetchImpl });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.token.accessToken, JWT);
  const rejected = await exchangeAgentApiKey("nope", { fetch: fetchImpl });
  assert.equal(rejected.ok, false);
});

test("the action client sends the JWT and polls with nextSince", async () => {
  const calls: string[] = [];
  const fetchImpl: FetchLike = async (url, init) => {
    calls.push(`${init?.method} ${url}`);
    assert.equal(header(init, "authorization"), `Bearer ${JWT}`);
    if (url.endsWith("/agent/chats")) return jsonResponse({ chats: [{ id: CHAT }] });
    if (url.includes("/agent/events")) return jsonResponse({
      events: [
        { type: "message.created", message: { id: "1", senderId: AGENT, text: "outline" } },
        { type: "message.created", message: { id: "2", senderId: PEER, text: "got it", media: { kind: "file" } } },
      ],
      nextSince: 50,
    });
    return jsonResponse({ message: { id: "1", senderId: AGENT } });
  };
  const client = new GptActionsClient({ accessToken: JWT, fetch: fetchImpl });
  assert.deepEqual(await client.listChats(), [{ id: CHAT }]);
  const page = await client.listEvents(0);
  assert.equal(page.nextSince, 50);
  assert.equal(inboundMessages(page, AGENT).length, 1);
  assert.equal(senderIdOf(inboundMessages(page, AGENT)[0]?.message), PEER);
  const sent = await client.sendMessage({
    peerId: PEER,
    text: "The kids-book outline is ready.",
    clientId: "gpt-axe-outline-1",
    media: { kind: "image", mimeType: "image/png", dataUrl: TINY_PNG, security: "none" },
  });
  assert.equal(senderIdOf(sent.message), AGENT);
  assert.equal(calls.some((call) => call.startsWith("GET ") && call.includes("/v1/agent/events?since=0")), true);
  const messageCall = calls.find((call) => call.startsWith("POST ") && call.includes("/agent/messages"));
  assert.equal(messageCall, "POST https://api.zivrapp.com/v1/agent/messages");
});

test("send rejects a video, two targets, and an Actions-sized payload before fetch", async () => {
  let calls = 0;
  const fetchImpl: FetchLike = async () => {
    calls += 1;
    return jsonResponse({ message: { id: "pdf-1", senderId: AGENT } });
  };
  const client = new GptActionsClient({ accessToken: JWT, fetch: fetchImpl });
  await assert.rejects(
    () => client.sendMessage({ chatId: CHAT, peerId: PEER, text: "hi", clientId: "1" }),
    (err: unknown) => err instanceof GptActionsError && /exactly one/.test(err.message),
  );
  await assert.rejects(
    () => client.sendMessage({
      peerId: PEER,
      text: "clip",
      clientId: "2",
      media: { kind: "file", mimeType: "video/mp4", dataUrl: "data:video/mp4;base64,AAAA" },
    }),
    /video/i,
  );
  await assert.rejects(
    () => client.sendMessage({
      chatId: CHAT,
      text: "big",
      clientId: "3",
      media: { kind: "file", mimeType: "application/pdf", dataUrl: `data:application/pdf;base64,${"A".repeat(GPT_ACTION_MAX_CHARS)}` },
    }),
    /100000|characters/i,
  );
  const pdf = await client.sendMessage({
    chatId: CHAT,
    text: "one page",
    clientId: "4",
    media: { kind: "file", mimeType: "application/pdf", dataUrl: TINY_PDF, fileName: "outline.pdf" },
  });
  assert.equal(pdf.status, 200);
  assert.equal(calls, 1);
});

test("calendar propose posts the slot and surfaces Retry-After", async () => {
  const bodies: unknown[] = [];
  const fetchImpl: FetchLike = async (_url, init) => {
    bodies.push(JSON.parse(String(init?.body)));
    return jsonResponse({ error: "Slow down", code: "rate" }, 429, { "retry-after": "9" });
  };
  const client = new GptActionsClient({
    accessToken: JWT,
    fetch: fetchImpl,
    now: () => Date.parse("2026-11-03T00:00:00Z"),
  });
  const startsAt = Date.parse("2026-11-03T15:00:00Z");
  await assert.rejects(
    () => client.proposeCalendar({
      chatId: CHAT,
      title: "Outline review",
      startsAt,
      endsAt: startsAt + 30 * 60 * 1000,
      clientId: "slot-1",
      note: "AXE",
    }),
    (err: unknown) => err instanceof GptActionsError && err.status === 429 && err.retryAfter === 9,
  );
  assert.deepEqual(bodies[0], {
    chatId: CHAT,
    title: "Outline review",
    startsAt,
    endsAt: startsAt + 30 * 60 * 1000,
    clientId: "slot-1",
    note: "AXE",
  });
});
