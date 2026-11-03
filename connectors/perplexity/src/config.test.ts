import assert from "node:assert/strict";
import test from "node:test";
import { loadPerplexityConfig, perplexityAgentUrl } from "./config.js";

test("the Agent API URL is /v1/agent on the configured origin", () => {
  assert.equal(perplexityAgentUrl("https://api.perplexity.ai"), "https://api.perplexity.ai/v1/agent");
  assert.equal(perplexityAgentUrl("https://example.test/v1"), "https://example.test/v1/agent");
  assert.throws(() => perplexityAgentUrl("http://user:pass@example.test"), /credentials/);
});

test("config requires the Perplexity key and a bounded token limit", () => {
  assert.throws(() => loadPerplexityConfig({}), /PERPLEXITY_API_KEY/);
  const config = loadPerplexityConfig({ PERPLEXITY_API_KEY: "pplx-test-key", PERPLEXITY_MODEL: "openai/gpt-test" });
  assert.equal(config.model, "openai/gpt-test");
  assert.equal(config.maxOutputTokens, 1024);
  assert.throws(
    () => loadPerplexityConfig({ PERPLEXITY_API_KEY: "pplx-test-key", PERPLEXITY_MAX_OUTPUT_TOKENS: "1" }),
    /PERPLEXITY_MAX_OUTPUT_TOKENS/,
  );
});
