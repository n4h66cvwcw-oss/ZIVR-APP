import assert from "node:assert/strict";
import test from "node:test";
import { runConnectorCli } from "./cli.js";
import type { SendMessageInput, ZivrAgentApi } from "./client.js";
import type { TurnInput, TurnResult } from "./prompt.js";

const PEER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CHAT = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

function harness(argv: string[], zivr: ZivrAgentApi, turns: TurnInput[] = []) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const run = runConnectorCli({
    commandName: "zivr-gemini",
    providerName: "Gemini",
    argv,
    env: {},
    stdout: (text) => stdout.push(text),
    stderr: (text) => stderr.push(text),
    loadZivr: () => zivr,
    loadSession: () => ({
      async runTurn(input: TurnInput): Promise<TurnResult> {
        turns.push(input);
        return { text: "I told AXE.", toolCalls: 1, sends: 1 };
      },
    }),
    readFile: () => TINY_PNG,
  });
  return { run, stdout: () => stdout.join(""), stderr: () => stderr.join("") };
}

test("send posts as the agent without calling the provider", async () => {
  const sent: SendMessageInput[] = [];
  const { run, stdout } = harness(["send", "--peer", PEER, "--text", "The outline is ready.", "--file", "outline.png"], {
    async agentUserId() { return "agent"; },
    async listChats() { return []; },
    async listEvents() { return { events: [], nextSince: 0 }; },
    async sendMessage(input) {
      sent.push(input);
      return { status: 201, body: { message: { id: "m1", chatId: CHAT, type: "image" } } };
    },
  });
  assert.equal(await run, 0);
  assert.equal(sent.length, 1);
  assert.equal(sent[0]?.peerId, PEER);
  assert.equal(sent[0]?.media?.kind, "image");
  assert.match(stdout(), /messageId: m1/);
});

test("ask gives the model a mediaRef and prints its text", async () => {
  const turns: TurnInput[] = [];
  const { run, stdout, stderr } = harness(
    ["ask", "--text", "Tell AXE the kids-book outline is ready.", "--file", "outline.png"],
    {
      async agentUserId() { return "agent"; },
      async listChats() { return []; },
      async listEvents() { return { events: [], nextSince: 0 }; },
      async sendMessage() { throw new Error("ask does not send by itself"); },
    },
    turns,
  );
  assert.equal(await run, 0);
  assert.match(turns[0]?.text ?? "", /file:1/);
  assert.match(turns[0]?.text ?? "", /kids-book outline/);
  assert.equal(turns[0]?.files[0]?.mimeType, "image/png");
  assert.match(stdout(), /I told AXE/);
  assert.match(stderr(), /Delivered 1 ZIVR message/);
});

test("unknown commands and a missing target fail", async () => {
  const idle: ZivrAgentApi = {
    async agentUserId() { return "agent"; },
    async listChats() { return []; },
    async listEvents() { return { events: [], nextSince: 0 }; },
    async sendMessage() { throw new Error("no"); },
  };
  const unknown = harness(["nope"], idle);
  assert.equal(await unknown.run, 1);
  assert.match(unknown.stderr(), /Unknown command/);
  const both = harness(["send", "--peer", PEER, "--chat", CHAT, "--text", "hi"], idle);
  assert.equal(await both.run, 1);
  assert.match(both.stderr(), /exactly one/);
});
