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
