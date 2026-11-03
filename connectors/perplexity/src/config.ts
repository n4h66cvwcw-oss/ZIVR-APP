import { parseHttpUrl } from "@workspace/zivr-agent-client";

export const DEFAULT_PERPLEXITY_BASE = "https://api.perplexity.ai";
export const DEFAULT_PERPLEXITY_MODEL = "openai/gpt-5.6-sol";
export const DEFAULT_MAX_OUTPUT_TOKENS = 1024;

export type PerplexityConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
  maxOutputTokens: number;
};

export function perplexityAgentUrl(baseUrl: string): string {
  const base = parseHttpUrl(baseUrl, "PERPLEXITY_API_BASE");
  const root = base.pathname.replace(/\/+$/, "").replace(/\/v1$/, "");
  base.pathname = `${root}/v1/agent`;
  base.search = "";
  base.hash = "";
  return base.toString();
}

export function loadPerplexityConfig(env: NodeJS.ProcessEnv): PerplexityConfig {
  const apiKey = env["PERPLEXITY_API_KEY"]?.trim() ?? "";
  if (apiKey.length < 8 || /\s/.test(apiKey)) {
    throw new Error("Set PERPLEXITY_API_KEY. This bridge calls the Perplexity Agent API with that key.");
  }
  const model = env["PERPLEXITY_MODEL"]?.trim() || DEFAULT_PERPLEXITY_MODEL;
  if (!/^[A-Za-z0-9._/-]{1,120}$/.test(model)) throw new Error("PERPLEXITY_MODEL is invalid");
  const rawTokens = env["PERPLEXITY_MAX_OUTPUT_TOKENS"]?.trim();
  const maxOutputTokens = rawTokens == null || rawTokens === "" ? DEFAULT_MAX_OUTPUT_TOKENS : Number(rawTokens);
  if (!Number.isInteger(maxOutputTokens) || maxOutputTokens < 16 || maxOutputTokens > 8192) {
    throw new Error("PERPLEXITY_MAX_OUTPUT_TOKENS must be an integer from 16 to 8192");
  }
  const baseUrl = env["PERPLEXITY_API_BASE"]?.trim() || DEFAULT_PERPLEXITY_BASE;
  perplexityAgentUrl(baseUrl);
  return { apiKey, baseUrl, model, maxOutputTokens };
}
