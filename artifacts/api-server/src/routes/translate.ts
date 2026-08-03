import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { logger } from "../lib/logger";

const router = Router();

const anthropic = new Anthropic({
  baseURL: process.env["AI_INTEGRATIONS_ANTHROPIC_BASE_URL"],
  apiKey: process.env["AI_INTEGRATIONS_ANTHROPIC_API_KEY"] ?? "placeholder",
});

router.post("/translate", async (req, res) => {
  const { text, targetLanguage, sourceLanguage } = req.body as {
    text?: string;
    targetLanguage?: string;
    sourceLanguage?: string;
  };

  if (!text?.trim() || !targetLanguage?.trim()) {
    res.status(400).json({ error: "text and targetLanguage are required" });
    return;
  }

  // Don't bother translating if source === target
  if (sourceLanguage && sourceLanguage.toLowerCase() === targetLanguage.toLowerCase()) {
    res.json({ translatedText: text, targetLanguage });
    return;
  }

  try {
    const sourcePart = sourceLanguage ? ` The source language is ${sourceLanguage}.` : "";
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 8192,
      messages: [
        {
          role: "user",
          content: `Translate the following text to ${targetLanguage}.${sourcePart} Return ONLY the translated text with no explanations, no quotes, no preamble — just the translation.\n\n${text}`,
        },
      ],
    });

    const block = message.content[0];
    const translatedText = block.type === "text" ? block.text.trim() : text;
    res.json({ translatedText, targetLanguage });
  } catch (err) {
    logger.error(err, "Translation failed");
    res.status(500).json({ error: err instanceof Error ? err.message : "Translation failed" });
  }
});

export default router;
