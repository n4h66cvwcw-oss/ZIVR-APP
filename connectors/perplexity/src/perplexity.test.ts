import assert from "node:assert/strict";
import test from "node:test";
import { PerplexityClient, PerplexityError } from "./perplexity.js";

test("the Agent API call uses a bearer key and /v1/agent", async () => {
  const client = new PerplexityClient({
    apiKey: "pplx-test-key",
    baseUrl: "https://api.perplexity.ai",
    model: "openai/gpt-5.6-sol",
    maxOutputTokens: 1024,
    fetch: async (url, init) => {
      assert.equal(url, "https://api.perplexity.ai/v1/agent");
      const headers = init?.headers as Record<string, string>;
      assert.equal(headers["authorization"], "Bearer pplx-test-key");
      const body = JSON.parse(String(init?.body)) as { model: string; max_output_tokens: number };
      assert.equal(body.model, "openai/gpt-5.6-sol");
      assert.equal(body.max_output_tokens, 1024);
      assert.equal(JSON.stringify(body).includes("pplx-test-key"), false);
      return new Response(JSON.stringify({
        output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text: "done" }] }],
      }), { status: 200 });
    },
  });
  const output = await client.respond([], [], "instructions");
  assert.equal(output[0]?.["type"], "message");
});

test("a provider error stays a PerplexityError", async () => {
  const client = new PerplexityClient({
    apiKey: "pplx-test-key",
    baseUrl: "https://api.perplexity.ai",
    model: "openai/gpt-5.6-sol",
    maxOutputTokens: 1024,
    fetch: async () => new Response(JSON.stringify({ error: { message: "quota" } }), { status: 429 }),
  });
  await assert.rejects(() => client.respond([], [], ""), (err: unknown) => err instanceof PerplexityError && err.status === 429 && /quota/.test(err.message));
});
