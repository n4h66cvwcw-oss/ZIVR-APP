import assert from "node:assert/strict";
import test from "node:test";
import { GeminiClient, GeminiError } from "./gemini.js";

test("generateContent sends the API key in a header and not the URL", async () => {
  let seen = "";
  const client = new GeminiClient({
    apiKey: "test-gemini-key",
    model: "gemini-3.8-flash",
    baseUrl: "https://generativelanguage.googleapis.com",
    fetch: async (url, init) => {
      seen = url;
      assert.equal(new URL(url).search, "");
      const headers = init?.headers as Record<string, string>;
      assert.equal(headers["x-goog-api-key"], "test-gemini-key");
      assert.equal(JSON.stringify(init?.body).includes("test-gemini-key"), false);
      return new Response(JSON.stringify({
        candidates: [{ content: { role: "model", parts: [{ text: "hello" }] } }],
      }), { status: 200, headers: { "content-type": "application/json" } });
    },
  });
  const content = await client.generate({ contents: [] });
  assert.equal(seen.endsWith(":generateContent"), true);
  assert.deepEqual(content.parts, [{ text: "hello" }]);
});

test("a Gemini error body becomes GeminiError without echoing the key", async () => {
  const client = new GeminiClient({
    apiKey: "test-gemini-key",
    model: "gemini-3.8-flash",
    baseUrl: "https://generativelanguage.googleapis.com",
    fetch: async () => new Response(JSON.stringify({ error: { message: "model is overloaded" } }), { status: 503 }),
  });
  await assert.rejects(() => client.generate({}), (err: unknown) => {
    return err instanceof GeminiError && err.status === 503 && /overloaded/.test(err.message) && !err.message.includes("test-gemini-key");
  });
});
