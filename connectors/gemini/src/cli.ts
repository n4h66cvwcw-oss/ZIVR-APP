#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { AttachmentStash, ZivrAgentClient, loadZivrConfig, runConnectorCli, type FetchLike } from "@workspace/zivr-agent-client";
import { loadGeminiConfig } from "./config.js";
import { GeminiClient } from "./gemini.js";
import { GeminiSession } from "./session.js";

export async function main(
  env: NodeJS.ProcessEnv = process.env,
  argv: string[] = process.argv.slice(2),
  fetchImpl?: FetchLike,
): Promise<number> {
  return runConnectorCli({
    commandName: "zivr-gemini",
    providerName: "Gemini",
    argv,
    env,
    stdout: (text) => process.stdout.write(text),
    stderr: (text) => process.stderr.write(text),
    loadZivr: (current) => {
      const config = loadZivrConfig(current);
      return new ZivrAgentClient({
        apiKey: config.apiKey,
        baseUrl: config.baseUrl,
        ...(fetchImpl ? { fetch: fetchImpl } : {}),
      });
    },
    loadSession: (current, zivr, stash: AttachmentStash) => {
      const config = loadGeminiConfig(current);
      const gemini = new GeminiClient({
        apiKey: config.apiKey,
        baseUrl: config.baseUrl,
        model: config.model,
        ...(fetchImpl ? { fetch: fetchImpl } : {}),
      });
      return new GeminiSession(gemini, zivr, stash);
    },
  });
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
  main().then((code) => {
    process.exitCode = code;
  }).catch((err: unknown) => {
    const message = err instanceof Error ? err.message : "zivr-gemini failed";
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
