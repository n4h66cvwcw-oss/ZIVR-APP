import { readFileSync } from "node:fs";
import { API_KEY_PATTERN, DEFAULT_API_BASE } from "./limits.js";
import { resolveAgentUrl } from "./client.js";

export type ZivrMcpConfig = {
  apiKey: string;
  baseUrl: string;
};

function nonempty(value: string | undefined): string | undefined {
  if (value == null) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * `ZIVR_API_KEY` and `ZIVR_API_BASE` win over a JSON file at `ZIVR_MCP_CONFIG`.
 * The file shape is `{ "apiKey": "zivr_agent_…", "baseUrl": "https://api.zivrapp.com" }`.
 */
export function loadConfig(
  env: NodeJS.ProcessEnv,
  readFile: (path: string) => string = (path) => readFileSync(path, "utf8"),
): ZivrMcpConfig {
  let fromFile: { apiKey?: unknown; baseUrl?: unknown } = {};
  const configPath = nonempty(env["ZIVR_MCP_CONFIG"]);
  if (configPath) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFile(configPath)) as unknown;
    } catch {
      throw new Error(`Could not read ZIVR_MCP_CONFIG at ${configPath}`);
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("ZIVR_MCP_CONFIG must be a JSON object");
    }
    fromFile = parsed as { apiKey?: unknown; baseUrl?: unknown };
  }
  const fileKey = typeof fromFile.apiKey === "string" ? fromFile.apiKey.trim() : "";
  const fileBase = typeof fromFile.baseUrl === "string" ? fromFile.baseUrl.trim() : "";
  const apiKey = nonempty(env["ZIVR_API_KEY"]) ?? fileKey;
  const baseUrl = nonempty(env["ZIVR_API_BASE"]) ?? (fileBase || DEFAULT_API_BASE);
  if (!apiKey) throw new Error("Set ZIVR_API_KEY, or apiKey in the ZIVR_MCP_CONFIG file");
  if (!API_KEY_PATTERN.test(apiKey)) throw new Error("ZIVR_API_KEY must be a one-time zivr_agent_… key");
  try {
    resolveAgentUrl(baseUrl, "agent/token");
  } catch (err) {
    const message = err instanceof Error ? err.message : "ZIVR_API_BASE must be an http(s) URL";
    throw new Error(message);
  }
  return { apiKey, baseUrl };
}
