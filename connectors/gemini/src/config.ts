import { parseHttpUrl } from "@workspace/zivr-agent-client";

export const DEFAULT_GEMINI_BASE = "https://generativelanguage.googleapis.com";
export const DEFAULT_GEMINI_MODEL = "gemini-3.8-flash";

export type GeminiConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
};

export function geminiGenerateUrl(baseUrl: string, model: string): string {
  const base = parseHttpUrl(baseUrl, "GEMINI_API_BASE");
  const root = base.pathname.replace(/\/+$/, "").replace(/\/v1beta$/, "");
  base.pathname = `${root}/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  base.search = "";
  base.hash = "";
  return base.toString();
}

export function loadGeminiConfig(env: NodeJS.ProcessEnv): GeminiConfig {
  const apiKey = env["GEMINI_API_KEY"]?.trim() ?? "";
  if (apiKey.length < 8 || /\s/.test(apiKey)) {
    throw new Error("Set GEMINI_API_KEY to a Google AI Studio API key. This bridge does not use Google OAuth.");
  }
  const model = env["GEMINI_MODEL"]?.trim() || DEFAULT_GEMINI_MODEL;
  if (!/^[A-Za-z0-9._-]{1,80}$/.test(model)) throw new Error("GEMINI_MODEL is invalid");
  const baseUrl = env["GEMINI_API_BASE"]?.trim() || DEFAULT_GEMINI_BASE;
  geminiGenerateUrl(baseUrl, model);
  return { apiKey, baseUrl, model };
}
