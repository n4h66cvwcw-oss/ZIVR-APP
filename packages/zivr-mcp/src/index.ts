#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { loadConfig } from "./config.js";
import { ZivrAgentClient } from "./client.js";
import { serveStdio } from "./stdio.js";

export { ZivrAgentClient, ZivrApiError, ZivrScopeError, resolveAgentUrl } from "./client.js";
export { loadConfig } from "./config.js";
export { verifyWebhookSignature, webhookSignature } from "./webhook.js";
export { serveStdio } from "./stdio.js";

export async function main(env: NodeJS.ProcessEnv = process.env): Promise<void> {
  let config: ReturnType<typeof loadConfig>;
  try {
    config = loadConfig(env);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid ZIVR MCP config";
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
    return;
  }
  process.stderr.write(`zivr-mcp ready (${config.baseUrl})\n`);
  const client = new ZivrAgentClient({ apiKey: config.apiKey, baseUrl: config.baseUrl });
  await serveStdio(client);
}

function invokedDirectly(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return import.meta.url === pathToFileURL(realpathSync(entry)).href;
  } catch {
    return false;
  }
}

if (invokedDirectly()) {
  main().catch((err: unknown) => {
    const message = err instanceof Error ? err.message : "zivr-mcp failed";
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
