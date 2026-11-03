import assert from "node:assert/strict";
import test from "node:test";
import { geminiGenerateUrl, loadGeminiConfig } from "./config.js";

const KEY = `zivr_agent_${"a".repeat(24)}`;

test("the generateContent URL stays on the configured origin and omits the key", () => {
  assert.equal(
    geminiGenerateUrl("https://generativelanguage.googleapis.com", "gemini-3.8-flash"),
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent",
  );
  assert.equal(
    geminiGenerateUrl("https://example.test/v1beta/", "gemini-3.8-flash"),
    "https://example.test/v1beta/models/gemini-3.8-flash:generateContent",
  );
  assert.throws(() => geminiGenerateUrl("https://user:pass@example.test", "gemini-3.8-flash"), /credentials/);
});

test("config requires an API key and does not read the ZIVR key as a Gemini key", () => {
  assert.throws(() => loadGeminiConfig({ ZIVR_API_KEY: KEY }), /GEMINI_API_KEY/);
  const config = loadGeminiConfig({ GEMINI_API_KEY: "test-gemini-key", GEMINI_MODEL: "gemini-test" });
  assert.equal(config.model, "gemini-test");
  assert.equal(config.apiKey, "test-gemini-key");
  assert.throws(() => loadGeminiConfig({ GEMINI_API_KEY: "test-gemini-key", GEMINI_MODEL: "bad model" }), /GEMINI_MODEL/);
});
