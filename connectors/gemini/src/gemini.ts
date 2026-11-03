import { asRecord, type FetchLike } from "@workspace/zivr-agent-client";
import { geminiGenerateUrl } from "./config.js";

export class GeminiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "GeminiError";
    this.status = status;
  }
}

export type GeminiContent = {
  role?: string;
  parts?: unknown[];
};

export type GeminiCall = {
  name: string;
  args: unknown;
  id?: string;
};

export type GeminiClientOptions = {
  apiKey: string;
  model: string;
  baseUrl: string;
  fetch?: FetchLike;
  timeoutMs?: number;
};

function errorMessage(body: unknown, status: number): string {
  const record = asRecord(body);
  const error = record?.["error"];
  const nested = asRecord(error);
  const message = nested && typeof nested["message"] === "string"
    ? nested["message"]
    : typeof error === "string"
      ? error
      : "";
  return message.trim().slice(0, 500) || `Gemini returned ${status}`;
}

export function geminiCalls(content: GeminiContent): GeminiCall[] {
  const calls: GeminiCall[] = [];
  for (const part of content.parts ?? []) {
    const call = asRecord(asRecord(part)?.["functionCall"]);
    if (!call || typeof call["name"] !== "string" || call["name"].length === 0) continue;
    calls.push({
      name: call["name"],
      args: call["args"] ?? {},
      ...(typeof call["id"] === "string" && call["id"].length > 0 ? { id: call["id"] } : {}),
    });
  }
  return calls;
}

export function geminiText(content: GeminiContent): string {
  const bits: string[] = [];
  for (const part of content.parts ?? []) {
    const text = asRecord(part)?.["text"];
    if (typeof text === "string" && text.trim()) bits.push(text);
  }
  return bits.join("\n").trim();
}

export class GeminiClient {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: FetchLike;
  private readonly timeoutMs: number;

  constructor(options: GeminiClientOptions) {
    this.apiKey = options.apiKey;
    this.model = options.model;
    this.baseUrl = options.baseUrl;
    this.fetchImpl = options.fetch ?? ((url, init) => fetch(url, init));
    this.timeoutMs = options.timeoutMs ?? 60_000;
  }

  async generate(body: unknown): Promise<GeminiContent> {
    const url = geminiGenerateUrl(this.baseUrl, this.model);
    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          "x-goog-api-key": this.apiKey,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (err) {
      const name = err instanceof Error ? err.name : "";
      if (name === "TimeoutError" || name === "AbortError") throw new GeminiError("Gemini request timed out", 0);
      const message = err instanceof Error ? err.message : "network error";
      throw new GeminiError(`Gemini request failed: ${message}`, 0);
    }
    const text = await response.text();
    let parsed: unknown = null;
    if (text) {
      try {
        parsed = JSON.parse(text) as unknown;
      } catch {
        parsed = text.slice(0, 500);
      }
    }
    if (response.status < 200 || response.status >= 300) {
      throw new GeminiError(errorMessage(parsed, response.status), response.status);
    }
    const record = asRecord(parsed);
    const candidates = record && Array.isArray(record["candidates"]) ? record["candidates"] : [];
    const content = asRecord(asRecord(candidates[0])?.["content"]);
    if (!content) {
      const reason = asRecord(record?.["promptFeedback"])?.["blockReason"];
      const detail = typeof reason === "string" && reason ? `Gemini blocked the prompt (${reason})` : "Gemini returned no content";
      throw new GeminiError(detail, response.status);
    }
    return content;
  }
}
