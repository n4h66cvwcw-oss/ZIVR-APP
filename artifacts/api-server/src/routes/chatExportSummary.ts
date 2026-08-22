import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { getAuthUserId } from "../lib/auth";
import { query } from "../lib/db";
import { logger } from "../lib/logger";

const router = Router();

const anthropic = new Anthropic({
  baseURL: process.env["AI_INTEGRATIONS_ANTHROPIC_BASE_URL"],
  apiKey: process.env["AI_INTEGRATIONS_ANTHROPIC_API_KEY"] ?? "placeholder",
});

type ExportMessage = {
  senderName?: string;
  text: string;
  timestamp?: number;
};

const MAX_MESSAGES = 100;
const MAX_TRANSCRIPT_CHARS = 24000;
const MAX_APPENDIX_CHARS = 6000;
const RATE_WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 4;

async function canCreateAppendix(userId: string): Promise<boolean> {
  const now = Date.now();
  const windowStartedAt = now - (now % RATE_WINDOW_MS);
  const rows = await query<{ requestCount: number }>(
    `INSERT INTO vm_ai_export_rate_limits (user_id, window_started_at, request_count)
     VALUES ($1, $2, 1)
     ON CONFLICT (user_id) DO UPDATE
       SET window_started_at = CASE
             WHEN vm_ai_export_rate_limits.window_started_at < $2 THEN $2
             ELSE vm_ai_export_rate_limits.window_started_at
           END,
           request_count = CASE
             WHEN vm_ai_export_rate_limits.window_started_at < $2 THEN 1
             ELSE vm_ai_export_rate_limits.request_count + 1
           END
     WHERE vm_ai_export_rate_limits.window_started_at < $2
        OR vm_ai_export_rate_limits.request_count < $3
     RETURNING request_count AS "requestCount"`,
    [userId, windowStartedAt, MAX_REQUESTS_PER_WINDOW]
  );
  return rows.length === 1;
}

router.post("/chat-export-summary", async (req, res) => {
  const userId = getAuthUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Invalid or missing auth token" });
    return;
  }

  const { messages, chatName, format } = req.body as {
    messages?: ExportMessage[];
    chatName?: string;
    format?: "summary" | "bullets";
  };

  if (!messages?.length || (format !== "summary" && format !== "bullets")) {
    res.status(400).json({ error: "messages and a valid format are required" });
    return;
  }
  if (!(await canCreateAppendix(userId))) {
    res.status(429).json({ error: "AI appendix limit reached. Please try again later." });
    return;
  }

  let sourceTruncated = messages.length > MAX_MESSAGES;
  const boundedMessages = messages.slice(-MAX_MESSAGES);
  let transcript = "";

  for (const message of boundedMessages) {
    const text = typeof message.text === "string" ? message.text.trim() : "";
    if (!text) continue;
    const line = `${message.senderName?.trim() || "Participant"}: ${text}`;
    if (transcript.length + line.length + 1 > MAX_TRANSCRIPT_CHARS) {
      sourceTruncated = true;
      break;
    }
    transcript += `${line}\n`;
  }

  if (!transcript.trim()) {
    res.status(400).json({ error: "At least one text message is required" });
    return;
  }

  const requestedOutput = format === "bullets"
    ? "Return 3–8 concise bullet points under 1,200 characters total. Each bullet must start with a hyphen. Do not add a heading."
    : "Return one concise, neutral paragraph under 1,200 characters total. Do not add a heading.";
  const prompt = `Create a neutral ${format} for an optional appendix to a private chat export.

Conversation title: ${chatName?.trim() || "Untitled chat"}
Transcript:
---
${transcript.trim()}
---

Do not invent facts, infer intent, give legal advice, or make claims of authenticity or completeness. ${requestedOutput}`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 8192,
      messages: [{ role: "user", content: prompt }],
    });
    const block = response.content[0];
    const appendix = block.type === "text" ? block.text.trim().slice(0, MAX_APPENDIX_CHARS) : "";
    if (!appendix) {
      res.status(502).json({ error: "The AI service did not return an appendix" });
      return;
    }
    res.json({ appendix, sourceTruncated });
  } catch (error) {
    logger.error(error, "Chat export appendix failed");
    res.status(500).json({ error: "Could not create the AI appendix" });
  }
});

export default router;