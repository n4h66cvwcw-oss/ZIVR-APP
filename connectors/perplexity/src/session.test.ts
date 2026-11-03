import assert from "node:assert/strict";
import test from "node:test";
import { AttachmentStash, ZivrAgentClient, type FetchLike } from "@workspace/zivr-agent-client";
import { PerplexityClient } from "./perplexity.js";
import { PerplexitySession } from "./session.js";

const KEY = `zivr_agent_${"a".repeat(24)}`;
const AGENT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PEER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CHAT = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const TINY_PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const TINY_PDF = "JVBERi0xLjEKJcKlwrE=";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

test("a custom function pauses the Agent API and the bridge returns function_call_output", async () => {
  const requests: Array<Record<string, unknown>> = [];
  let providerCalls = 0;
  const fetchImpl: FetchLike = async (url, init) => {
    const payload = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {};
    if (url.endsWith("/agent/token")) {
      return json({ accessToken: "jwt", expiresIn: 3600, agentUserId: AGENT, scopes: ["messages:send", "messages:read", "media:send", "chats:list"] });
    }
    if (url.endsWith("/v1/agent/messages")) {
      const media = payload["media"] as { kind?: string; fileName?: string };
      assert.equal(media.kind, "file");
      assert.equal(media.fileName, "outline.pdf");
      return json({ message: { id: "m1", chatId: CHAT, type: "file" } }, 201);
    }
    if (url.endsWith("/v1/agent")) {
      requests.push(payload);
      providerCalls += 1;
      if (providerCalls === 1) {
        return json({
          output: [{
            type: "function_call",
            call_id: "call_1",
            name: "zivr_send_message",
            arguments: JSON.stringify({ peerId: PEER, text: "The outline is ready.", mediaRef: "file:1", clientId: "outline-1" }),
          }],
        });
      }
      return json({
        output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text: "I sent AXE the PDF." }] }],
      });
    }
    throw new Error(`unexpected ${url}`);
  };
  const stash = new AttachmentStash();
  const ref = stash.put({
    kind: "file",
    mimeType: "application/pdf",
    dataUrl: `data:application/pdf;base64,${TINY_PDF}`,
    fileName: "outline.pdf",
  });
  assert.equal(ref, "file:1");
  const session = new PerplexitySession(
    new PerplexityClient({
      apiKey: "pplx-test-key",
      baseUrl: "https://api.perplexity.ai",
      model: "openai/gpt-5.6-sol",
      maxOutputTokens: 256,
      fetch: fetchImpl,
    }),
    new ZivrAgentClient({ apiKey: KEY, fetch: fetchImpl }),
    stash,
  );
  const result = await session.runTurn({
    text: "Tell AXE the kids-book outline is ready and attach file:1.",
    files: [{ mimeType: "image/png", base64: TINY_PNG, mediaRef: "file:9", fileName: "cover.png" }, { mimeType: "application/pdf", base64: TINY_PDF, mediaRef: ref, fileName: "outline.pdf" }],
  });
  assert.equal(result.text, "I sent AXE the PDF.");
  assert.equal(result.sends, 1);
  const firstInput = requests[0]?.["input"] as Array<{ content?: Array<{ type?: string; image_url?: string; filename?: string }> }>;
  const parts = firstInput[0]?.content ?? [];
  assert.equal(parts.some((part) => part.type === "input_image" && part.image_url?.startsWith("data:image/png;base64,")), true);
  assert.equal(parts.some((part) => part.type === "input_file" && part.filename === "outline.pdf"), true);
  const tools = requests[0]?.["tools"] as Array<{ type?: string }>;
  assert.equal(tools.every((tool) => tool.type === "function"), true);
  assert.equal(tools.some((tool) => tool.type === "web_search"), false);
  const secondInput = requests[1]?.["input"] as Array<{ type?: string; call_id?: string }>;
  assert.equal(secondInput.some((item) => item.type === "function_call_output" && item.call_id === "call_1"), true);
  assert.equal(JSON.stringify(requests).includes("pplx-test-key"), false);
});
