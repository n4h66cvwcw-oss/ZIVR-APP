import { SERVER_INSTRUCTIONS, SERVER_NAME, SERVER_VERSION } from "./limits.js";
import {
  callTool,
  listToolDefinitions,
  type ToolSession,
  type ZivrToolApi,
} from "./tools.js";

const SUPPORTED_PROTOCOLS = ["2025-06-18", "2025-03-26", "2024-11-05"];

export type RpcMessage = {
  jsonrpc?: unknown;
  id?: unknown;
  method?: unknown;
  params?: unknown;
};

export function negotiateProtocol(version: unknown): string {
  if (typeof version === "string" && SUPPORTED_PROTOCOLS.includes(version)) return version;
  return "2024-11-05";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function result(id: unknown, value: unknown): Record<string, unknown> {
  return { jsonrpc: "2.0", id, result: value };
}

function rpcError(id: unknown, code: number, message: string): Record<string, unknown> {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

export async function dispatch(
  message: RpcMessage,
  deps: { api: ZivrToolApi; session: ToolSession; now?: () => number },
): Promise<Record<string, unknown> | null> {
  if (!Object.prototype.hasOwnProperty.call(message, "id")) return null;
  const method = typeof message.method === "string" ? message.method : "";
  if (!method) return rpcError(message.id, -32600, "Invalid request");
  if (method === "initialize") {
    const params = asRecord(message.params);
    return result(message.id, {
      protocolVersion: negotiateProtocol(params?.["protocolVersion"]),
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
      instructions: SERVER_INSTRUCTIONS,
    });
  }
  if (method === "ping") return result(message.id, {});
  if (method === "tools/list") {
    const tools = await listToolDefinitions(deps.api);
    return result(message.id, { tools });
  }
  if (method === "tools/call") {
    const params = asRecord(message.params);
    const name = typeof params?.["name"] === "string" ? params["name"] : "";
    if (!name) return rpcError(message.id, -32602, "tools/call requires a name");
    const args = params?.["arguments"] === undefined ? {} : params["arguments"];
    const toolResult = await callTool(name, args, deps.api, deps.session, deps.now?.() ?? Date.now());
    return result(message.id, toolResult);
  }
  return rpcError(message.id, -32601, `Method not found: ${method}`);
}
