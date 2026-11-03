import assert from "node:assert/strict";
import test from "node:test";
import { AttachmentStash, ZivrAgentClient, type FetchLike } from "@workspace/zivr-agent-client";
import { GeminiClient } from "./gemini.js";
import { GeminiSession } from "./session.js";

const KEY = `zivr_agent_${"a".repeat(24)}`;
const AGENT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PEER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CHAT = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const TINY_PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

test("a function call is executed on ZIVR and the response id is sent back", async () => {
  const bodies: unknown[] = [];
  let geminiCalls = 0;
  const fetchImpl: FetchLike = async (url, init) => {
    const payload = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {};
    if (url.endsWith("/agent/token")) {
      return json({ accessToken: "jwt", expiresIn: 3600, agentUserId: AGENT, scopes: ["messages:send", "messages:read", "media:send", "chats:list"] });
    }
    if (url.endsWith("/agent/messages")) {
      assert.equal(payload["peerId"], PEER);
      assert.equal(payload["text"], "The kids-book outline is ready.");
      return json({ message: { id: "m1", chatId: CHAT, type: "text" } }, 201);
    }
    if (url.endsWith(":generateContent")) {
      bodies.push(payload);
      geminiCalls += 1;
      if (geminiCalls === 1) {
        return json({
          candidates: [{
            content: {
              role: "model",
              parts: [{ functionCall: { name: "zivr_send_message", id: "call-1", args: { peerId: PEER, text: "The kids-book outline is ready.", clientId: "outline-1" } } }],
            },
          }],
        });
      }
      return json({ candidates: [{ content: { role: "model", parts: [{ text: "I told AXE." }] } }] });
    }
    throw new Error(`unexpected ${url}`);
  };
  const zivr = new ZivrAgentClient({ apiKey: KEY, fetch: fetchImpl });
  const session = new GeminiSession(
    new GeminiClient({ apiKey: "test-gemini-key", model: "gemini-3.8-flash", baseUrl: "https://generativelanguage.googleapis.com", fetch: fetchImpl }),
    zivr,
    new AttachmentStash(),
  );
  const result = await session.runTurn({ text: "Tell AXE the kids-book outline is ready.", files: [] });
  assert.equal(result.text, "I told AXE.");
  assert.equal(result.sends, 1);
  const followUp = bodies[1] as { contents: Array<{ parts?: unknown[] }> };
  const responsePart = followUp.contents.at(-1)?.parts?.[0] as { functionResponse?: { id?: string; name?: string } };
  assert.equal(responsePart.functionResponse?.id, "call-1");
  assert.equal(responsePart.functionResponse?.name, "zivr_send_message");
  assert.equal(JSON.stringify(bodies).includes("test-gemini-key"), false);
});

test("inbound image bytes are inlined on the user turn and on a read_new response", async () => {
  let geminiCalls = 0;
  const bodies: unknown[] = [];
  const fetchImpl: FetchLike = async (url, init) => {
    const payload = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {};
    if (url.endsWith("/agent/token")) {
      return json({ accessToken: "jwt", expiresIn: 3600, agentUserId: AGENT, scopes: ["messages:send", "messages:read", "chats:list"] });
    }
    if (url.includes("/agent/events")) {
      return json({
        events: [{
          type: "message.created",
          message: { id: "in", senderId: PEER, chatId: CHAT, text: "page", media: { kind: "image", mimeType: "image/png", dataUrl: TINY_PNG } },
        }],
        nextSince: 9,
      });
    }
    bodies.push(payload);
    geminiCalls += 1;
    if (geminiCalls === 1) {
      return json({
        candidates: [{ content: { role: "model", parts: [{ functionCall: { name: "zivr_read_new", id: "read-1", args: {} } }] } }],
      });
    }
    return json({ candidates: [{ content: { role: "model", parts: [{ text: "AXE sent a page." }] } }] });
  };
  const session = new GeminiSession(
    new GeminiClient({ apiKey: "test-gemini-key", model: "gemini-3.8-flash", baseUrl: "https://generativelanguage.googleapis.com", fetch: fetchImpl }),
    new ZivrAgentClient({ apiKey: KEY, fetch: fetchImpl }),
    new AttachmentStash(),
  );
  const png = TINY_PNG.split(",")[1] ?? "";
  const result = await session.runTurn({
    text: "Read what AXE sent.",
    files: [{ mimeType: "image/png", base64: png, mediaRef: "file:1" }],
  });
  assert.equal(result.text, "AXE sent a page.");
  const first = bodies[0] as { contents: Array<{ parts: Array<{ inlineData?: { mimeType: string } }> }> };
  assert.equal(first.contents[0]?.parts[1]?.inlineData?.mimeType, "image/png");
  const second = bodies[1] as { contents: Array<{ parts: Array<{ functionResponse?: { parts?: Array<{ inlineData?: { mimeType: string } }> } }> }> };
  const inline = second.contents.at(-1)?.parts[0]?.functionResponse?.parts?.[0]?.inlineData?.mimeType;
  assert.equal(inline, "image/png");
});
