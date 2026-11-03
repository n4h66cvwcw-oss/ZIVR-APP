import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import readline from "node:readline";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { ZivrApiError } from "./client.js";
import { dispatch } from "./rpc.js";
import {
  callTool,
  createToolSession,
  listToolDefinitions,
  type ToolCallResult,
  type ZivrToolApi,
} from "./tools.js";

const KEY = `zivr_agent_${"d".repeat(24)}`;
const AGENT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PEER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CHAT = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const SCOPES = ["messages:send", "messages:read", "media:send", "chats:list", "calendar:read", "calendar:propose"];
const TINY_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const TINY_PDF = "data:application/pdf;base64,JVBERi0xLjEKJcKlwrE=";

function textOf(result: ToolCallResult): string {
  const block = result.content[0];
  return block?.type === "text" ? block.text : "";
}

function fakeApi(overrides: Partial<ZivrToolApi> = {}): { api: ZivrToolApi; calls: string[] } {
  const calls: string[] = [];
  const api: ZivrToolApi = {
    async agentUserId() {
      calls.push("id");
      return AGENT;
    },
    async scopes() {
      calls.push("scopes");
      return SCOPES;
    },
    async listChats() {
      calls.push("chats");
      return [{ id: CHAT, type: "direct", name: null }];
    },
    async listEvents(since) {
      calls.push(`events:${since}`);
      return { events: [], nextSince: since };
    },
    async sendMessage(input) {
      calls.push(`send:${JSON.stringify(input)}`);
      return { status: 200, body: { message: { id: "m1", chatId: CHAT, type: input.media ? "file" : "text", text: input.text } } };
    },
    async proposeCalendar(input) {
      calls.push(`cal:${input.clientId}`);
      return {
        status: 201,
        body: {
          proposal: { id: "p1", status: "pending", chatId: input.chatId, title: input.title, startsAt: input.startsAt, endsAt: input.endsAt },
          message: { id: "m2" },
        },
      };
    },
    ...overrides,
  };
  return { api, calls };
}

test("invalid send and read arguments never call the API", async () => {
  const { api, calls } = fakeApi();
  const session = createToolSession();
  const missing = await callTool("zivr_send_message", { peerId: PEER, text: "hi" }, api, session);
  assert.equal(missing.isError, true);
  assert.match(textOf(missing), /clientId is required/);
  const since = await callTool("zivr_read_new", { since: -5 }, api, session);
  assert.equal(since.isError, true);
  assert.equal(calls.length, 0);
  assert.equal(session.since, 0);
});

test("same-owner send then read returns the other agent's image", async () => {
  const sent: unknown[] = [];
  const { api, calls } = fakeApi({
    async sendMessage(input) {
      sent.push(input);
      calls.push("send");
      return { status: 200, body: { message: { id: "out", chatId: CHAT, type: "file", text: "spec" } } };
    },
    async listEvents(since) {
      calls.push(`events:${since}`);
      return {
        events: [{
          type: "message.created",
          message: {
            id: "in",
            chatId: CHAT,
            senderId: PEER,
            senderName: "AXE twin",
            text: "draft",
            type: "image",
            createdAt: 50,
            media: { kind: "image", mimeType: "image/png", dataUrl: TINY_PNG, security: "none" },
          },
        }],
        nextSince: 50,
      };
    },
  });
  const session = createToolSession();
  const send = await callTool("zivr_send_message", {
    peerId: PEER,
    text: "spec",
    clientId: "loop-1",
    media: { kind: "file", dataUrl: TINY_PDF, fileName: "spec.pdf" },
  }, api, session);
  assert.equal(send.isError, undefined);
  assert.match(textOf(send), /Sent\./);
  const body = sent[0] as { peerId?: string; media?: { fileName?: string; kind?: string } };
  assert.equal(body.peerId, PEER);
  assert.equal(body.media?.kind, "file");
  assert.equal(body.media?.fileName, "spec.pdf");

  const read = await callTool("zivr_read_new", {}, api, session);
  assert.equal(read.isError, undefined);
  assert.match(textOf(read), /You are agent/);
  assert.match(textOf(read), /AXE twin/);
  assert.match(textOf(read), /nextSince: 50/);
  const image = read.content.find((block) => block.type === "image");
  assert.equal(image?.type, "image");
  if (image?.type === "image") {
    assert.equal(image.mimeType, "image/png");
    assert.equal(image.data, TINY_PNG.slice(TINY_PNG.indexOf(",") + 1));
  }
  assert.equal(session.since, 50);
  assert.equal(calls.includes("events:0"), true);

  await callTool("zivr_read_new", {}, api, session);
  assert.equal(calls.includes("events:50"), true);
  await callTool("zivr_read_new", { since: 10 }, api, session);
  assert.equal(calls.includes("events:10"), true);
});

test("a failed poll does not move the cursor, and a PDF comes back as a resource", async () => {
  const session = createToolSession();
  session.since = 5;
  const failing = fakeApi({
    async listEvents() {
      throw new ZivrApiError("This profile reached the per-minute message limit", 429, "rate_limited", 60);
    },
  });
  const error = await callTool("zivr_read_new", {}, failing.api, session);
  assert.equal(error.isError, true);
  assert.match(textOf(error), /429 \(rate_limited\)/);
  assert.match(textOf(error), /Retry after 60s/);
  assert.equal(session.since, 5);

  const pdf = fakeApi({
    async listEvents() {
      return {
        events: [{
          type: "message.created",
          message: {
            id: "file-1",
            chatId: CHAT,
            senderId: PEER,
            senderName: "AXE twin",
            text: "",
            type: "file",
            createdAt: 9,
            media: { kind: "file", mimeType: "application/pdf", dataUrl: TINY_PDF, fileName: "notes.pdf" },
          },
        }],
        nextSince: 9,
      };
    },
  });
  const read = await callTool("zivr_read_new", { since: 0 }, pdf.api, createToolSession());
  const resource = read.content.find((block) => block.type === "resource");
  assert.equal(resource?.type, "resource");
  if (resource?.type === "resource") {
    assert.equal(resource.resource.mimeType, "application/pdf");
    assert.equal(resource.resource.name, "notes.pdf");
    assert.equal(resource.resource.blob, TINY_PDF.slice(TINY_PDF.indexOf(",") + 1));
  }
});

test("calendar propose is omitted only when the key lacks the scope", async () => {
  const withScope = fakeApi();
  const names = (await listToolDefinitions(withScope.api)).map((tool) => tool.name);
  assert.deepEqual(names, ["zivr_read_new", "zivr_list_chats", "zivr_send_message", "zivr_calendar_propose"]);

  const without = fakeApi({
    async scopes() {
      return ["messages:send", "messages:read", "chats:list"];
    },
  });
  const hidden = (await listToolDefinitions(without.api)).map((tool) => tool.name);
  assert.equal(hidden.includes("zivr_calendar_propose"), false);

  const unknown = fakeApi({
    async scopes() {
      throw new ZivrApiError("API key is invalid", 401, "auth");
    },
  });
  const listed = (await listToolDefinitions(unknown.api)).map((tool) => tool.name);
  assert.equal(listed.includes("zivr_calendar_propose"), true);

  const now = 1_700_000_000_000;
  const proposed = await callTool("zivr_calendar_propose", {
    chatId: CHAT,
    title: "Lunch",
    startsAt: now + 3_600_000,
    endsAt: now + 5_400_000,
    clientId: "cal-1",
  }, withScope.api, createToolSession(), now);
  assert.match(textOf(proposed), /pending/);
  assert.match(textOf(proposed), /p1/);
});

test("dispatch speaks initialize and turns a bad tool call into an error result", async () => {
  const { api } = fakeApi();
  const session = createToolSession();
  const init = await dispatch({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: { protocolVersion: "2025-03-26" },
  }, { api, session });
  const initResult = init?.["result"] as { protocolVersion: string; serverInfo: { name: string }; instructions: string };
  assert.equal(initResult.protocolVersion, "2025-03-26");
  assert.equal(initResult.serverInfo.name, "zivr");
  assert.match(initResult.instructions, /zivr_read_new/);
  assert.equal(await dispatch({ jsonrpc: "2.0", method: "notifications/initialized" }, { api, session }), null);

  const call = await dispatch({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: { name: "zivr_send_message", arguments: { text: "hi" } },
  }, { api, session });
  const toolResult = call?.["result"] as ToolCallResult;
  assert.equal(toolResult.isError, true);
  assert.equal(call?.["error"], undefined);
});

test("the stdio entry answers initialize without calling the API", async () => {
  const entry = fileURLToPath(new URL("./index.js", import.meta.url));
  const child = spawn(process.execPath, [entry], {
    env: {
      ...process.env,
      ZIVR_API_KEY: KEY,
      ZIVR_API_BASE: "https://api.zivrapp.com",
      ZIVR_MCP_CONFIG: "",
    },
    stdio: ["pipe", "pipe", "pipe"],
  });
  let stderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk: string) => { stderr += chunk; });
  child.stdin.write(`${JSON.stringify({
    jsonrpc: "2.0",
    id: 7,
    method: "initialize",
    params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "test", version: "0" } },
  })}\n`);
  const line = await new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out waiting for initialize\n${stderr}`)), 5000);
    const lines = readline.createInterface({ input: child.stdout });
    lines.once("line", (value) => {
      clearTimeout(timer);
      lines.close();
      resolve(value);
    });
    child.once("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`exited ${code}\n${stderr}`));
    });
  });
  const message = JSON.parse(line) as { id: number; result: { serverInfo: { name: string }; protocolVersion: string } };
  assert.equal(message.id, 7);
  assert.equal(message.result.serverInfo.name, "zivr");
  assert.equal(message.result.protocolVersion, "2024-11-05");
  assert.match(stderr, /zivr-mcp ready/);
  child.kill();
  await new Promise((resolve) => child.once("exit", resolve));
});
