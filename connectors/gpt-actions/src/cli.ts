#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { depsFromEnv, startOAuthServer } from "./http.js";

export async function main(env: NodeJS.ProcessEnv = process.env): Promise<void> {
  let deps: ReturnType<typeof depsFromEnv>;
  try {
    deps = depsFromEnv(env);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid GPT Actions OAuth config";
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
    return;
  }
  const port = Number(env["PORT"] ?? 8787);
  const server = await startOAuthServer({
    ...deps,
    port: Number.isInteger(port) && port > 0 ? port : 8787,
    host: "127.0.0.1",
  });
  process.stderr.write(
    [
      `zivr-gpt-actions listening on ${server.url}`,
      "This process only serves the OAuth consent and token steps.",
      "ChatGPT must call those paths on the same host as /v1/agent.",
      "Set ZIVR_GPT_OAUTH_CLIENT_ID and ZIVR_GPT_OAUTH_CLIENT_SECRET on the API for production.",
      "",
    ].join("\n"),
  );
  await new Promise<void>((resolve) => {
    process.once("SIGINT", () => resolve());
    process.once("SIGTERM", () => resolve());
  });
  await server.close();
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
    const message = err instanceof Error ? err.message : "zivr-gpt-actions failed";
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
