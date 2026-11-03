import { asRecord, type FetchLike } from "@workspace/zivr-agent-client";
import { perplexityAgentUrl } from "./config.js";

export class PerplexityError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "PerplexityError";
    this.status = status;
  }
}

export type PerplexityItem = Record<string, unknown>;

export type PerplexityCall = {
  name: string;
  callId: string;
  arguments: string;
};

export type PerplexityClientOptions = {
  apiKey: string;
  baseUrl: string;
  model: string;
  maxOutputTokens: number;
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
  return message.trim().slice(0, 500) || `Perplexity returned ${status}`;
}

export function perplexityCalls(output: PerplexityItem[]): PerplexityCall[] {
  const calls: PerplexityCall[] = [];
  for (const item of output) {
    if (item["type"] !== "function_call") continue;
    const name = item["name"];
    const callId = item["call_id"];
    if (typeof name !== "string" || typeof callId !== "string") continue;
    const args = item["arguments"];
    calls.push({ name, callId, arguments: typeof args === "string" ? args : "{}" });
  }
  return calls;
}

export function perplexityText(output: PerplexityItem[]): string {
  const bits: string[] = [];
  for (const item of output) {
    if (item["type"] !== "message") continue;
    const content = item["content"];
    if (typeof content === "string" && content.trim()) bits.push(content);
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      const record = asRecord(part);
      if (record?.["type"] === "output_text" && typeof record["text"] === "string" && record["text"].trim()) {
        bits.push(record["text"]);
      }
    }
  }
  return bits.join("\n").trim();
}

export class PerplexityClient {
  readonly model: string;
  readonly maxOutputTokens: number;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: FetchLike;
  private readonly timeoutMs: number;

  constructor(options: PerplexityClientOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl;
    this.model = options.model;
    this.maxOutputTokens = options.maxOutputTokens;
    this.fetchImpl = options.fetch ?? ((url, init) => fetch(url, init));
    this.timeoutMs = options.timeoutMs ?? 60_000;
  }

  async respond(input: unknown[], tools: unknown[], instructions: string): Promise<PerplexityItem[]> {
    const url = perplexityAgentUrl(this.baseUrl);
    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          instructions,
          input,
          tools,
          max_output_tokens: this.maxOutputTokens,
        }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (err) {
      const name = err instanceof Error ? err.name : "";
      if (name === "TimeoutError" || name === "AbortError") throw new PerplexityError("Perplexity request timed out", 0);
      const message = err instanceof Error ? err.message : "network error";
      throw new PerplexityError(`Perplexity request failed: ${message}`, 0);
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
      throw new PerplexityError(errorMessage(parsed, response.status), response.status);
    }
    const output = asRecord(parsed)?.["output"];
    if (!Array.isArray(output)) throw new PerplexityError("Perplexity returned no output", response.status);
    return output.filter((item): item is PerplexityItem => item != null && typeof item === "object" && !Array.isArray(item));
  }
}
