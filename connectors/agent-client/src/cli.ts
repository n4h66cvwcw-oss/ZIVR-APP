import { readFileSync } from "node:fs";
import {
  DEFAULT_BRIDGE_INTERVAL_MS,
  MAX_BRIDGE_INTERVAL_MS,
  MIN_BRIDGE_INTERVAL_MS,
} from "./limits.js";
import { mediaFromFile } from "./media.js";
import { createTurnQueue, pollBridge, startWebhookServer } from "./bridge.js";
import {
  AttachmentStash,
  formatEventPage,
  formatSendResult,
  inboundEvents,
  type PromptFile,
  type TurnSession,
} from "./prompt.js";
import type { ZivrAgentApi } from "./client.js";

export type ConnectorCliOptions = {
  commandName: string;
  providerName: string;
  argv: string[];
  env: NodeJS.ProcessEnv;
  stdout: (text: string) => void;
  stderr: (text: string) => void;
  loadZivr: (env: NodeJS.ProcessEnv) => ZivrAgentApi;
  loadSession: (env: NodeJS.ProcessEnv, zivr: ZivrAgentApi, stash: AttachmentStash) => TurnSession;
  readFile?: (path: string) => Buffer;
  sleep?: (ms: number) => Promise<void>;
};

type ParsedArgs = {
  command: string;
  help: boolean;
  once: boolean;
  peer?: string;
  chat?: string;
  text?: string;
  file?: string;
  clientId?: string;
  since?: string;
  interval?: string;
  webhookPort?: string;
  rest: string[];
};

function write(out: (text: string) => void, text: string): void {
  out(text.endsWith("\n") ? text : `${text}\n`);
}

export function helpText(commandName: string, providerName: string): string {
  return [
    `${commandName} — scripted bridge from one ZIVR agent twin to ${providerName}.`,
    "",
    "This process holds the ZIVR agent key and the provider API key.",
    `${providerName} does not receive ZIVR webhooks and does not call ZIVR by itself.`,
    "",
    "Commands:",
    `  ${commandName} send --peer <uuid> [--text <text>] [--file <path>] [--client-id <id>]`,
    `  ${commandName} send --chat <uuid> [--text <text>] [--file <path>] [--client-id <id>]`,
    `  ${commandName} chats`,
    `  ${commandName} poll [--since <ms>]`,
    `  ${commandName} ask [--file <path>] (--text <text> | <text…>)`,
    `  ${commandName} bridge [--since <ms>] [--interval <ms>] [--webhook-port <port>] [--once]`,
    "",
    "send and poll talk to ZIVR only. ask and bridge also call the provider.",
    "bridge prints model text. A ZIVR reply is delivered only when the model calls zivr_send_message.",
    "With --webhook-port, POST /zivr/hooks is answered before the provider call.",
    "ZIVR's webhook delivery times out in about 3 seconds and is not retried. Polling is the reliable path.",
  ].join("\n");
}

function parseArgs(argv: string[]): ParsedArgs {
  const parsed: ParsedArgs = { command: "", help: false, once: false, rest: [] };
  const items = [...argv];
  parsed.command = items.shift() ?? "";
  while (items.length > 0) {
    const item = items.shift() ?? "";
    if (item === "--help" || item === "-h") {
      parsed.help = true;
      continue;
    }
    if (item === "--once") {
      parsed.once = true;
      continue;
    }
    const take = (flag: string): string => {
      const value = items.shift();
      if (!value || value.startsWith("--")) throw new Error(`${flag} needs a value`);
      return value;
    };
    if (item === "--peer") parsed.peer = take(item);
    else if (item === "--chat") parsed.chat = take(item);
    else if (item === "--text") parsed.text = take(item);
    else if (item === "--file") parsed.file = take(item);
    else if (item === "--client-id") parsed.clientId = take(item);
    else if (item === "--since") parsed.since = take(item);
    else if (item === "--interval") parsed.interval = take(item);
    else if (item === "--webhook-port") parsed.webhookPort = take(item);
    else if (item.startsWith("--")) throw new Error(`Unknown flag ${item}`);
    else parsed.rest.push(item);
  }
  return parsed;
}

function parseSince(value: string | undefined): number {
  if (value == null || value === "") return 0;
  if (!/^\d+$/.test(value)) throw new Error("since must be an epoch millisecond cursor");
  return Number(value);
}

function parseInterval(value: string | undefined): number {
  if (value == null || value === "") return DEFAULT_BRIDGE_INTERVAL_MS;
  if (!/^\d+$/.test(value)) throw new Error(`interval must be ${MIN_BRIDGE_INTERVAL_MS}–${MAX_BRIDGE_INTERVAL_MS} milliseconds`);
  const interval = Number(value);
  if (interval < MIN_BRIDGE_INTERVAL_MS || interval > MAX_BRIDGE_INTERVAL_MS) {
    throw new Error(`interval must be ${MIN_BRIDGE_INTERVAL_MS}–${MAX_BRIDGE_INTERVAL_MS} milliseconds`);
  }
  return interval;
}

function parsePort(value: string | undefined): number | undefined {
  if (value == null || value === "") return undefined;
  if (!/^\d+$/.test(value)) throw new Error("webhook-port must be a TCP port");
  const port = Number(value);
  if (port < 1 || port > 65535) throw new Error("webhook-port must be a TCP port");
  return port;
}

export async function runConnectorCli(options: ConnectorCliOptions): Promise<number> {
  let parsed: ParsedArgs;
  try {
    parsed = parseArgs(options.argv);
  } catch (err) {
    write(options.stderr, err instanceof Error ? err.message : "Could not parse arguments");
    return 1;
  }
  if (parsed.help || parsed.command === "help" || parsed.command === "") {
    write(options.stdout, helpText(options.commandName, options.providerName));
    return parsed.command === "" && !parsed.help ? 1 : 0;
  }
  try {
    if (parsed.command === "send") return await commandSend(options, parsed);
    if (parsed.command === "chats") return await commandChats(options);
    if (parsed.command === "poll") return await commandPoll(options, parsed);
    if (parsed.command === "ask") return await commandAsk(options, parsed);
    if (parsed.command === "bridge") return await commandBridge(options, parsed);
    write(options.stderr, `Unknown command ${parsed.command}`);
    write(options.stderr, helpText(options.commandName, options.providerName));
    return 1;
  } catch (err) {
    write(options.stderr, err instanceof Error ? err.message : "Command failed");
    return 1;
  }
}

function loadOwnedFile(options: ConnectorCliOptions, filePath: string) {
  const readFile = options.readFile ?? ((path: string) => readFileSync(path));
  return mediaFromFile(filePath, readFile(filePath));
}

async function commandSend(options: ConnectorCliOptions, parsed: ParsedArgs): Promise<number> {
  if ((parsed.peer == null) === (parsed.chat == null)) {
    throw new Error("Provide exactly one of --peer or --chat");
  }
  const media = parsed.file ? loadOwnedFile(options, parsed.file) : undefined;
  const text = parsed.text ?? parsed.rest.join(" ");
  if (!text.trim() && !media) throw new Error("Provide --text or --file");
  const zivr = options.loadZivr(options.env);
  const result = await zivr.sendMessage({
    ...(parsed.chat ? { chatId: parsed.chat } : {}),
    ...(parsed.peer ? { peerId: parsed.peer } : {}),
    ...(text ? { text } : {}),
    clientId: parsed.clientId ?? `cli-${Date.now().toString(36)}`,
    ...(media ? { media } : {}),
  });
  write(options.stdout, formatSendResult(result));
  return 0;
}

async function commandChats(options: ConnectorCliOptions): Promise<number> {
  const chats = await options.loadZivr(options.env).listChats();
  write(options.stdout, chats.length === 0 ? "No chats yet." : JSON.stringify(chats, null, 2));
  return 0;
}

async function commandPoll(options: ConnectorCliOptions, parsed: ParsedArgs): Promise<number> {
  const since = parseSince(parsed.since);
  const zivr = options.loadZivr(options.env);
  const page = await zivr.listEvents(since);
  const agentUserId = await zivr.agentUserId();
  const inbound = inboundEvents(page, agentUserId).length;
  write(options.stdout, formatEventPage(page, agentUserId, since, new Map()));
  write(options.stdout, `inbound: ${inbound}`);
  return 0;
}

async function commandAsk(options: ConnectorCliOptions, parsed: ParsedArgs): Promise<number> {
  const text = parsed.text ?? parsed.rest.join(" ");
  if (!text.trim() && !parsed.file) throw new Error("Provide the text to ask");
  const stash = new AttachmentStash();
  const zivr = options.loadZivr(options.env);
  const session = options.loadSession(options.env, zivr, stash);
  let prompt = text.trim();
  const files: PromptFile[] = [];
  if (parsed.file) {
    const media = loadOwnedFile(options, parsed.file);
    const mediaRef = stash.put(media);
    const name = media.kind === "file" && media.fileName ? media.fileName : parsed.file;
    prompt = [
      prompt,
      `The operator attached ${mediaRef} (${name}, ${media.mimeType}).`,
      `To send it on ZIVR, call zivr_send_message with mediaRef "${mediaRef}". Do not paste the bytes.`,
    ].filter((part) => part !== "").join("\n\n");
    files.push({
      mimeType: media.mimeType,
      ...(media.kind === "file" && media.fileName ? { fileName: media.fileName } : {}),
      base64: media.dataUrl.split(",", 2)[1] ?? "",
      mediaRef,
    });
  }
  const result = await session.runTurn({ text: prompt || "The operator attached a file.", files });
  write(options.stdout, result.text || "(no text)");
  if (result.sends > 0) write(options.stderr, `Delivered ${result.sends} ZIVR message${result.sends === 1 ? "" : "s"}.`);
  return 0;
}

async function commandBridge(options: ConnectorCliOptions, parsed: ParsedArgs): Promise<number> {
  const since = parseSince(parsed.since);
  const intervalMs = parseInterval(parsed.interval);
  const webhookPort = parsePort(parsed.webhookPort);
  if (parsed.once && webhookPort != null) throw new Error("--once does not listen for webhooks");
  const stash = new AttachmentStash();
  const zivr = options.loadZivr(options.env);
  const session = options.loadSession(options.env, zivr, stash);
  const queue = createTurnQueue({
    zivr,
    session,
    stash,
    log: (line) => write(options.stderr, line),
    onTurn: (turn) => {
      write(options.stdout, `--- ${turn.messageId} ---`);
      write(options.stdout, turn.text || "(no text)");
      if (turn.sends > 0) write(options.stderr, `Delivered ${turn.sends} ZIVR message${turn.sends === 1 ? "" : "s"}.`);
    },
  });
  const controller = new AbortController();
  const stop = () => controller.abort();
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  let server: { close: () => Promise<void>; url: string } | undefined;
  try {
    if (webhookPort != null) {
      const secret = options.env["ZIVR_WEBHOOK_SECRET"]?.trim() ?? "";
      server = await startWebhookServer({
        secret,
        port: webhookPort,
        onEvent: (event) => queue.enqueue(event),
      });
      write(options.stderr, `Webhook listening on ${server.url}`);
      write(options.stderr, "Register that URL on this agent with the owner session. The listener answers before it calls the provider.");
    }
    write(options.stderr, parsed.once
      ? `${options.commandName} polling once`
      : `${options.commandName} polling every ${intervalMs}ms`);
    await pollBridge({
      zivr,
      session,
      stash,
      since,
      intervalMs,
      once: parsed.once,
      signal: controller.signal,
      ...(options.sleep ? { sleep: options.sleep } : {}),
      enqueue: (event) => queue.enqueue(event),
      log: (line) => write(options.stderr, line),
    });
    return 0;
  } finally {
    process.off("SIGINT", stop);
    process.off("SIGTERM", stop);
    if (server) await server.close();
  }
}
