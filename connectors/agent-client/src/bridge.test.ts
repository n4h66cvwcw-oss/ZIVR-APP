import assert from "node:assert/strict";
import test from "node:test";
import { createTurnQueue, pollBridge, startWebhookServer } from "./bridge.js";
import type { ZivrAgentApi } from "./client.js";
import { AttachmentStash } from "./prompt.js";
import { webhookSignature } from "./webhook.js";

const AGENT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PEER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CHAT = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const TINY_PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function zivr(): ZivrAgentApi {
  return {
    async agentUserId() { return AGENT; },
    async listChats() { return []; },
    async listEvents() {
      return {
        events: [
          { type: "message.created", message: { id: "own", senderId: AGENT, chatId: CHAT, text: "mine" } },
          {
            type: "message.created",
            message: {
              id: "in",
              senderId: PEER,
              chatId: CHAT,
              text: "got the outline",
              media: { kind: "image", mimeType: "image/png", dataUrl: TINY_PNG },
            },
          },
        ],
        nextSince: 25,
      };
    },
    async sendMessage() { throw new Error("not used"); },
  };
}

test("one poll forwards the other agent's file and skips this agent's echo", async () => {
  const seen: string[] = [];
  const result = await pollBridge({
    zivr: zivr(),
    stash: new AttachmentStash(),
    intervalMs: 500,
    once: true,
    session: {
      async runTurn(input) {
        seen.push(input.text);
        assert.equal(input.files[0]?.mimeType, "image/png");
        return { text: "I see it", toolCalls: 0, sends: 0 };
      },
    },
    onTurn: (turn) => assert.equal(turn.text, "I see it"),
  });
  assert.equal(result.since, 25);
  assert.equal(seen.length, 1);
  assert.match(seen[0] ?? "", /got the outline/);
});

test("the same inbound message is forwarded once", async () => {
  let turns = 0;
  const queue = createTurnQueue({
    zivr: zivr(),
    stash: new AttachmentStash(),
    session: {
      async runTurn() {
        turns += 1;
        return { text: "ok", toolCalls: 0, sends: 0 };
      },
    },
  });
  const event = { type: "message.created", message: { id: "in", senderId: PEER, chatId: CHAT, text: "again" } };
  await queue.enqueue(event);
  await queue.enqueue(event);
  assert.equal(turns, 1);
  await queue.enqueue({ type: "message.created", message: { id: "own", senderId: AGENT, text: "echo" } });
  assert.equal(turns, 1);
});

test("a failed poll keeps the cursor and a full page does not sleep", async () => {
  const seen: number[] = [];
  const sleeps: number[] = [];
  let polls = 0;
  const controller = new AbortController();
  const result = await pollBridge({
    zivr: {
      async agentUserId() { return AGENT; },
      async listChats() { return []; },
      async sendMessage() { throw new Error("not used"); },
      async listEvents(since) {
        polls += 1;
        seen.push(since);
        if (polls === 1) {
          return {
            events: Array.from({ length: 100 }, () => ({
              type: "message.created",
              message: { id: "same", senderId: PEER, chatId: CHAT, text: "page" },
            })),
            nextSince: 100,
          };
        }
        if (polls === 2) {
          const error = new Error("slow down");
          error.name = "ZivrApiError";
          throw Object.assign(error, { status: 429, code: "rate_limited", retryAfter: 12 });
        }
        controller.abort();
        return { events: [], nextSince: since };
      },
    },
    stash: new AttachmentStash(),
    session: { async runTurn() { return { text: "ok", toolCalls: 0, sends: 0 }; } },
    intervalMs: 500,
    signal: controller.signal,
    sleep: async (ms) => { sleeps.push(ms); },
  });
  assert.deepEqual(seen, [0, 100, 100]);
  assert.equal(result.since, 100);
  assert.deepEqual(sleeps, [500]);
});

test("the webhook answers before the provider turn and rejects a bad signature", async () => {
  const secret = "hook-secret";
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let started = false;
  const server = await startWebhookServer({
    secret,
    onEvent: async () => {
      started = true;
      await gate;
    },
  });
  try {
    const payload = JSON.stringify({
      type: "message.created",
      message: { id: "in", senderId: PEER, chatId: CHAT, text: "from hook" },
    });
    const denied = await fetch(server.url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-zivr-signature": "sha256=nope" },
      body: payload,
    });
    assert.equal(denied.status, 401);
    const accepted = await fetch(server.url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-zivr-signature": webhookSignature(secret, payload) },
      body: payload,
      signal: AbortSignal.timeout(1000),
    });
    assert.equal(accepted.status, 204);
    assert.equal(started, true);
  } finally {
    release();
    await server.close();
  }
});

test("a replayed webhook is delivered once and a rewritten timestamp fails the HMAC", async () => {
  const secret = "hook-secret";
  let turns = 0;
  const queue = createTurnQueue({
    zivr: zivr(),
    stash: new AttachmentStash(),
    session: {
      async runTurn() {
        turns += 1;
        return { text: "ok", toolCalls: 0, sends: 0 };
      },
    },
  });
  const server = await startWebhookServer({
    secret,
    onEvent: (event) => queue.enqueue(event),
  });
  try {
    const fresh = {
      type: "message.created",
      message: { id: "in", senderId: PEER, chatId: CHAT, text: "from hook", createdAt: 1_730_000_000_000 },
    };
    const payload = JSON.stringify(fresh);
    const signature = webhookSignature(secret, payload);
    const replay = await fetch(server.url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-zivr-signature": signature },
      body: payload,
    });
    const again = await fetch(server.url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-zivr-signature": signature },
      body: payload,
    });
    assert.equal(replay.status, 204);
    assert.equal(again.status, 204);
    const staleBody = JSON.stringify({
      ...fresh,
      message: { ...fresh.message, createdAt: 1_000 },
    });
    const tampered = await fetch(server.url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-zivr-signature": signature },
      body: staleBody,
    });
    assert.equal(tampered.status, 401);
    const oldButSigned = JSON.stringify({
      type: "message.created",
      message: { id: "older", senderId: PEER, chatId: CHAT, text: "late", createdAt: 1_000 },
    });
    const acceptedOld = await fetch(server.url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-zivr-signature": webhookSignature(secret, oldButSigned) },
      body: oldButSigned,
    });
    assert.equal(acceptedOld.status, 204);
    for (let attempt = 0; attempt < 50 && turns < 2; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    assert.equal(turns, 2);
  } finally {
    await server.close();
  }
});
