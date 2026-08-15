import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { logger } from "../lib/logger";

const router = Router();

const anthropic = new Anthropic({
  baseURL: process.env["AI_INTEGRATIONS_ANTHROPIC_BASE_URL"],
  apiKey: process.env["AI_INTEGRATIONS_ANTHROPIC_API_KEY"] ?? "placeholder",
});

type MessageContext = {
  sender: "me" | "them";
  senderName?: string;
  text: string;
  timestamp?: number;
};

router.post("/suggest-reply", async (req, res) => {
  const { messages, chatName, myName, recipientLanguage } = req.body as {
    messages?: MessageContext[];
    chatName?: string;
    myName?: string;
    recipientLanguage?: string;
  };

  if (!messages?.length) {
    res.status(400).json({ error: "messages array is required" });
    return;
  }

  // Build a readable transcript (last 30 messages max)
  const recent = messages.slice(-30);
  const meLabel = myName ?? "Me";
  const themLabel = chatName ?? "Them";

  const transcript = recent
    .filter((m) => m.text?.trim())
    .map((m) => {
      const label = m.sender === "me" ? meLabel : (m.senderName ?? themLabel);
      return `${label}: ${m.text.trim()}`;
    })
    .join("\n");

  const langNote = recipientLanguage
    ? ` Write the reply in ${recipientLanguage} since that is the recipient's language.`
    : "";

  const prompt = `You are a smart messaging assistant helping ${meLabel} reply in a conversation with ${themLabel}.

Here is the recent conversation:
---
${transcript}
---

Write a single, natural, concise reply from ${meLabel}'s perspective.${langNote} Match the tone and style of the conversation. Return ONLY the reply text — no quotes, no preamble, no explanation.`;

  try {
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    });

    const block = message.content[0];
    const suggestedReply = block.type === "text" ? block.text.trim() : "";
    res.json({ suggestedReply });
  } catch (err) {
    logger.error(err, "Suggest reply failed");
    res.status(500).json({ error: err instanceof Error ? err.message : "Suggest reply failed" });
  }
});

export default router;
