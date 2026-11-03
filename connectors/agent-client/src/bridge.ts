import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { ZivrApiError, type AgentEvent, type ZivrAgentApi } from "./client.js";
import { MAX_WEBHOOK_BODY_BYTES } from "./limits.js";
import {
  inboundEvents,
  messageKey,
  prepareInboundTurn,
  type AttachmentStash,
  type TurnResult,
  type TurnSession,
} from "./prompt.js";
import { verifyWebhookSignature } from "./webhook.js";

export type BridgeTurn = { messageId: string; text: string; sends: number };

export function formatBridgeError(err: unknown): string {
  if (err instanceof ZivrApiError) {
    const retry = err.retryAfter != null ? ` Retry after ${err.retryAfter}s.` : "";
    return `ZIVR API ${err.status}${err.code ? ` (${err.code})` : ""}: ${err.message}${retry}`;
  }
  return err instanceof Error ? err.message : "Bridge request failed";
}

export function createTurnQueue(options: {
  zivr: ZivrAgentApi;
  session: TurnSession;
  stash: AttachmentStash;
  onTurn?: (turn: BridgeTurn) => void;
  log?: (line: string) => void;
}) {
  const seen = new Set<string>();
  const order: string[] = [];
  let tail: Promise<void> = Promise.resolve();

  function remember(key: string): boolean {
    if (seen.has(key)) return false;
    seen.add(key);
    order.push(key);
    if (order.length > 1000) {
      const old = order.shift();
      if (old) seen.delete(old);
    }
    return true;
  }

  async function deliver(event: AgentEvent): Promise<void> {
    const agentUserId = await options.zivr.agentUserId().catch(() => "");
    if (inboundEvents({ events: [event], nextSince: 0 }, agentUserId).length === 0) return;
    const key = messageKey(event);
    if (!remember(key)) return;
    const turn = prepareInboundTurn(event, options.stash, agentUserId);
    if (!turn) return;
    let result: TurnResult;
    try {
      result = await options.session.runTurn(turn);
    } catch (err) {
      seen.delete(key);
      throw err;
    }
    options.onTurn?.({ messageId: key, text: result.text, sends: result.sends });
  }

  function enqueue(event: AgentEvent): Promise<void> {
    const run = tail.then(() => deliver(event));
    tail = run.then(() => undefined, (err: unknown) => {
      options.log?.(formatBridgeError(err));
    });
    return run;
  }

  return { enqueue };
}

export async function pollBridge(options: {
  zivr: ZivrAgentApi;
  session: TurnSession;
  stash: AttachmentStash;
  since?: number;
  intervalMs: number;
  once?: boolean;
  signal?: AbortSignal;
  sleep?: (ms: number) => Promise<void>;
  onTurn?: (turn: BridgeTurn) => void;
  log?: (line: string) => void;
  enqueue?: (event: AgentEvent) => Promise<void>;
}): Promise<{ since: number }> {
  const queue = options.enqueue
    ? { enqueue: options.enqueue }
    : createTurnQueue(options);
  const sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  let since = options.since ?? 0;
  while (!options.signal?.aborted) {
    let full = false;
    try {
      const page = await options.zivr.listEvents(since);
      since = page.nextSince;
      full = page.events.length >= 100;
      const agentUserId = await options.zivr.agentUserId().catch(() => "");
      for (const event of inboundEvents(page, agentUserId)) {
        await queue.enqueue(event);
      }
    } catch (err) {
      options.log?.(formatBridgeError(err));
    }
    if (options.once || options.signal?.aborted) return { since };
    if (!full) await sleep(options.intervalMs);
  }
  return { since };
}

function readRawBody(req: IncomingMessage, maxBytes: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    let settled = false;
    const fail = (err: unknown) => {
      if (settled) return;
      settled = true;
      reject(err);
    };
    const succeed = (body: Buffer) => {
      if (settled) return;
      settled = true;
      resolve(body);
    };
    req.on("data", (chunk: Buffer) => {
      total += chunk.byteLength;
      if (total > maxBytes) {
        fail(Object.assign(new Error("body too large"), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => succeed(Buffer.concat(chunks)));
    req.on("error", fail);
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "content-length": Buffer.byteLength(payload) });
  res.end(payload);
}

export type WebhookServer = {
  url: string;
  port: number;
  close: () => Promise<void>;
};

/**
 * Accepts `POST /zivr/hooks`, checks `x-zivr-signature`, and answers before `onEvent`.
 * ZIVR waits about 3 seconds and does not retry, so the provider call happens after the response.
 */
export function startWebhookServer(options: {
  secret: string;
  port?: number;
  host?: string;
  onEvent: (event: AgentEvent) => Promise<void> | void;
}): Promise<WebhookServer> {
  if (!options.secret) return Promise.reject(new Error("Set ZIVR_WEBHOOK_SECRET to the secret from the webhook registration"));
  const host = options.host ?? "127.0.0.1";
  const server: Server = createServer((req, res) => {
    void handleWebhook(req, res, options).catch((err: unknown) => {
      const status = typeof err === "object" && err && "status" in err && typeof err.status === "number" ? err.status : 400;
      if (!res.headersSent) sendJson(res, status, { error: err instanceof Error ? err.message : "bad request" });
      else res.destroy();
    });
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.port ?? 0, host, () => {
      const address = server.address();
      const port = address && typeof address === "object" ? address.port : options.port ?? 0;
      resolve({
        url: `http://${host}:${port}/zivr/hooks`,
        port,
        close: () => new Promise((done, fail) => server.close((err) => err ? fail(err) : done())),
      });
    });
  });
}

async function handleWebhook(
  req: IncomingMessage,
  res: ServerResponse,
  options: { secret: string; onEvent: (event: AgentEvent) => Promise<void> | void },
): Promise<void> {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  if (url.pathname !== "/zivr/hooks") {
    sendJson(res, 404, { error: "not found" });
    return;
  }
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "POST only" });
    return;
  }
  const raw = await readRawBody(req, MAX_WEBHOOK_BODY_BYTES);
  const header = req.headers["x-zivr-signature"];
  const signature = Array.isArray(header) ? header[0] : header;
  if (!verifyWebhookSignature(options.secret, raw, signature)) {
    sendJson(res, 401, { error: "invalid signature" });
    return;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.toString("utf8")) as unknown;
  } catch {
    sendJson(res, 400, { error: "invalid json" });
    return;
  }
  const body = parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? parsed as Record<string, unknown>
    : null;
  const type = body && typeof body["type"] === "string" ? body["type"] : "";
  const message = body && body["message"] && typeof body["message"] === "object" && !Array.isArray(body["message"])
    ? body["message"] as Record<string, unknown>
    : undefined;
  res.writeHead(204);
  res.end();
  if (type === "message.created" && message) {
    await options.onEvent({ type, message });
  }
}
