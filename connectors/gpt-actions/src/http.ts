import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { DEFAULT_API_BASE } from "./limits.js";
import { createHttpTokenExchanger } from "./client.js";
import { handleOAuthRequest, readOAuthConfig, type OAuthDeps, type OAuthHttpResponse } from "./oauth.js";
import { createMemoryAuthStore } from "./store.js";

const BODY_LIMIT = 16 * 1024;

function parsePayload(raw: string, contentType: string): Record<string, unknown> | null {
  if (!raw) return null;
  const type = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
  if (type === "application/json" || raw.trim().startsWith("{")) {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  }
  const params = new URLSearchParams(raw);
  const body: Record<string, unknown> = {};
  for (const [key, value] of params) body[key] = value;
  return body;
}

async function readRaw(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buf.length;
    if (size > BODY_LIMIT) {
      const error = new Error("too_large");
      error.name = "PayloadTooLarge";
      throw error;
    }
    chunks.push(buf);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function send(res: ServerResponse, outcome: OAuthHttpResponse): void {
  res.writeHead(outcome.status, outcome.headers);
  res.end(outcome.body);
}

/**
 * Standalone consent and token server for local debugging. ChatGPT Actions
 * must call these paths on the same host as `/v1/agent`, which is the API
 * process. This listener does not proxy agent routes.
 */
export function startOAuthServer(deps: OAuthDeps & { port?: number; host?: string }): Promise<{
  url: string;
  close: () => Promise<void>;
}> {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://127.0.0.1");
      let body: Record<string, unknown> | null = null;
      if (req.method === "POST" || req.method === "PUT" || req.method === "PATCH") {
        const raw = await readRaw(req);
        body = raw ? parsePayload(raw, req.headers["content-type"] ?? "") : null;
      }
      const outcome = await handleOAuthRequest({
        method: req.method ?? "GET",
        pathname: url.pathname,
        query: url.searchParams,
        body,
        authorization: typeof req.headers.authorization === "string" ? req.headers.authorization : null,
      }, deps);
      send(res, outcome);
    } catch (err) {
      const tooLarge = err instanceof Error && err.name === "PayloadTooLarge";
      const invalid = err instanceof SyntaxError;
      const status = tooLarge ? 413 : invalid ? 400 : 500;
      const error = tooLarge ? "invalid_request" : invalid ? "invalid_request" : "server_error";
      send(res, {
        status,
        headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
        body: JSON.stringify({ error }),
      });
    }
  });
  const host = deps.host ?? "127.0.0.1";
  const port = deps.port ?? 0;
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("OAuth server did not bind"));
        return;
      }
      resolve({
        url: `http://${host}:${address.port}`,
        close: () => new Promise((done, fail) => {
          server.close((error) => (error ? fail(error) : done()));
        }),
      });
    });
  });
}

export function depsFromEnv(env: NodeJS.ProcessEnv = process.env): OAuthDeps {
  const read = readOAuthConfig(env);
  if (read.state === "disabled") throw new Error("Set ZIVR_GPT_OAUTH_CLIENT_ID and ZIVR_GPT_OAUTH_CLIENT_SECRET");
  if (read.state === "invalid") throw new Error(read.error);
  return {
    config: read.config,
    store: createMemoryAuthStore(),
    exchange: createHttpTokenExchanger({ baseUrl: env["ZIVR_API_BASE"]?.trim() || DEFAULT_API_BASE }),
  };
}
