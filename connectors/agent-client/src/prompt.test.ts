import assert from "node:assert/strict";
import test from "node:test";
import { ZivrApiError, type ZivrAgentApi } from "./client.js";
import { AttachmentStash, executeZivrTool, createToolMemory, prepareInboundTurn } from "./prompt.js";

const AGENT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PEER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CHAT = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const TINY_PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const TINY_PDF = "data:application/pdf;base64,JVBERi0xLjEKJcKlwrE=";

function api(overrides: Partial<ZivrAgentApi> = {}): ZivrAgentApi {
  return {
    async agentUserId() { return AGENT; },
    async listChats() { return [{ id: CHAT }]; },
    async listEvents() { return { events: [], nextSince: 0 }; },
    async sendMessage(input) { return { status: 201, body: { message: { id: "m", chatId: input.chatId ?? CHAT, type: input.media ? "image" : "text" } } }; },
    ...overrides,
  };
}

test("send requires one target and resolves a local mediaRef", async () => {
  const stash = new AttachmentStash();
  const ref = stash.put({ kind: "file", mimeType: "application/pdf", dataUrl: TINY_PDF, fileName: "outline.pdf" });
  let sentMedia = false;
  const memory = createToolMemory();
  const missing = await executeZivrTool("zivr_send_message", { text: "hi" }, { zivr: api(), stash, memory, now: () => 1 });
  assert.equal(missing.result["ok"], false);
  const sent = await executeZivrTool(
    "zivr_send_message",
    { peerId: PEER, text: "outline", mediaRef: ref },
    {
      zivr: api({
        async sendMessage(input) {
          sentMedia = input.media?.kind === "file";
          return { status: 201, body: { message: { id: "m2", chatId: CHAT, type: "file" } } };
        },
      }),
      stash,
      memory,
      now: () => 2,
    },
  );
  assert.equal(sent.result["ok"], true);
  assert.equal(sentMedia, true);
  assert.match(String(sent.result["text"]), /Sent/);
});

test("read_new stashes inbound files and advances the cursor", async () => {
  const stash = new AttachmentStash();
  const memory = createToolMemory();
  const outcome = await executeZivrTool("zivr_read_new", {}, {
    zivr: api({
      async listEvents(since) {
        assert.equal(since, 0);
        return {
          events: [
            { type: "message.created", message: { id: "own", senderId: AGENT, text: "echo", media: { kind: "image", dataUrl: TINY_PNG } } },
            { type: "message.created", message: { id: "in", senderId: PEER, chatId: CHAT, text: "got it", media: { kind: "image", mimeType: "image/png", dataUrl: TINY_PNG } } },
          ],
          nextSince: 80,
        };
      },
    }),
    stash,
    memory,
  });
  assert.equal(memory.since, 80);
  assert.equal(outcome.files.length, 1);
  assert.equal(outcome.files[0]?.mediaRef, "file:1");
  assert.match(String(outcome.result["text"]), /file:1/);
  assert.doesNotMatch(String(outcome.result["text"]), /iVBORw0KGgo/);
});

test("an API failure stays inside the tool result", async () => {
  const outcome = await executeZivrTool("zivr_list_chats", {}, {
    zivr: api({
      async listChats() { throw new ZivrApiError("slow down", 429, "rate", 9); },
    }),
    stash: new AttachmentStash(),
    memory: createToolMemory(),
  });
  assert.equal(outcome.result["ok"], false);
  assert.match(String(outcome.result["error"]), /Retry after 9s/);
});

test("an inbound turn names the chat and quotes a text file", () => {
  const text = Buffer.from("chapter one").toString("base64");
  const turn = prepareInboundTurn({
    type: "message.created",
    message: {
      id: "in",
      chatId: CHAT,
      senderId: PEER,
      senderName: "AXE",
      text: "notes",
      createdAt: 1_730_000_000_000,
      media: { kind: "file", mimeType: "text/plain", fileName: "notes.txt", dataUrl: `data:text/plain;base64,${text}` },
    },
  }, new AttachmentStash(), AGENT);
  assert.ok(turn);
  assert.match(turn.text, new RegExp(CHAT));
  assert.match(turn.text, /file:1/);
  assert.match(turn.text, /chapter one/);
  assert.equal(turn.files[0]?.fileName, "notes.txt");
});
