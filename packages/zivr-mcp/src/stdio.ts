import readline from "node:readline";
import { ZivrAgentClient } from "./client.js";
import { dispatch, type RpcMessage } from "./rpc.js";
import { createToolSession } from "./tools.js";

export async function serveStdio(api: ZivrAgentClient): Promise<void> {
  const session = createToolSession();
  const lines = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
  for await (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let response: Record<string, unknown> | null;
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        response = { jsonrpc: "2.0", id: null, error: { code: -32600, message: "Invalid request" } };
      } else {
        response = await dispatch(parsed as RpcMessage, { api, session });
      }
    } catch {
      response = { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } };
    }
    if (response) process.stdout.write(`${JSON.stringify(response)}\n`);
  }
}
