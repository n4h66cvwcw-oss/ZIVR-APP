import assert from "node:assert/strict";
import test from "node:test";
import { loadConfig } from "./config.js";

const KEY = `zivr_agent_${"b".repeat(24)}`;
const OTHER = `zivr_agent_${"c".repeat(24)}`;

test("env wins over the config file and the default base is production", () => {
  const config = loadConfig(
    { ZIVR_API_KEY: KEY, ZIVR_MCP_CONFIG: "/tmp/zivr.json", ZIVR_API_BASE: "http://127.0.0.1:8080/api/" },
    () => JSON.stringify({ apiKey: OTHER, baseUrl: "https://example.test" }),
  );
  assert.equal(config.apiKey, KEY);
  assert.equal(config.baseUrl, "http://127.0.0.1:8080/api/");

  const fromFile = loadConfig(
    { ZIVR_MCP_CONFIG: "/tmp/zivr.json" },
    () => JSON.stringify({ apiKey: OTHER }),
  );
  assert.equal(fromFile.apiKey, OTHER);
  assert.equal(fromFile.baseUrl, "https://api.zivrapp.com");
});

test("rejects a missing key, a non-agent key, and a bad base URL", () => {
  assert.throws(() => loadConfig({}), /ZIVR_API_KEY/);
  assert.throws(() => loadConfig({ ZIVR_API_KEY: "sk-live" }), /zivr_agent_/);
  assert.throws(() => loadConfig({ ZIVR_API_KEY: KEY, ZIVR_API_BASE: "ftp://files" }), /http/);
  assert.throws(
    () => loadConfig({ ZIVR_MCP_CONFIG: "/missing.json" }, () => { throw new Error("enoent"); }),
    /Could not read/,
  );
});
