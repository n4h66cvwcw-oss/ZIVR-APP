/**
 * Connector-owned ChatGPT Actions OAuth.
 * Not part of /v1/agent. The access token given to ChatGPT is the JWT
 * exchangeAgentToken already issues. Disabled until both OAuth env vars are set.
 */
import { Router, type Request, type Response } from "express";
import {
  createMemoryAuthStore,
  handleOAuthRequest,
  readOAuthConfig,
  type OAuthHttpResponse,
} from "@workspace/zivr-gpt-actions";
import { exchangeAgentToken } from "../lib/agent-delivery";

const router = Router();
const store = createMemoryAuthStore();

function send(res: Response, outcome: OAuthHttpResponse): void {
  res.status(outcome.status);
  for (const [key, value] of Object.entries(outcome.headers)) res.setHeader(key, value);
  res.send(outcome.body);
}

router.use(async (req: Request, res: Response) => {
  const read = readOAuthConfig(process.env);
  if (read.state === "disabled") {
    res.status(404).json({ error: "GPT Actions OAuth is not configured", code: "gpt_oauth_disabled" });
    return;
  }
  if (read.state === "invalid") {
    res.status(500).json({ error: read.error, code: "gpt_oauth_invalid" });
    return;
  }
  const url = new URL(req.originalUrl, "http://127.0.0.1");
  const body = req.body && typeof req.body === "object" && !Array.isArray(req.body)
    ? req.body as Record<string, unknown>
    : null;
  const outcome = await handleOAuthRequest({
    method: req.method,
    pathname: url.pathname,
    query: url.searchParams,
    body,
    authorization: req.header("authorization") ?? null,
  }, {
    config: read.config,
    store,
    exchange: async (apiKey) => {
      try {
        const result = await exchangeAgentToken(apiKey);
        if (!result.ok) return { ok: false, status: result.status, error: result.error, code: result.code };
        return {
          ok: true,
          token: {
            accessToken: result.accessToken,
            expiresIn: result.expiresIn,
            tokenType: "Bearer" as const,
            agentUserId: result.agentUserId,
            scopes: result.scopes,
          },
        };
      } catch {
        return { ok: false, status: 502, error: "Token exchange failed", code: "upstream" };
      }
    },
  });
  send(res, outcome);
});

export default router;
