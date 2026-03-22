import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";

const router = Router();

const anthropic = new Anthropic({
  baseURL: process.env["AI_INTEGRATIONS_ANTHROPIC_BASE_URL"],
  apiKey: process.env["AI_INTEGRATIONS_ANTHROPIC_API_KEY"] ?? "dummy",
});

const SKIN_SYSTEM_PROMPT = `You are a creative skin designer for a messaging app called VibeMsg. When given a theme prompt, you generate a JSON skin configuration.

A skin defines the visual theme of the chat interface including bubble colors, background, and accents.

Respond ONLY with valid JSON (no markdown, no explanation) in this exact format:
{
  "name": "Short catchy name (max 30 chars)",
  "description": "1-2 sentence description capturing the vibe",
  "emoji": "Single relevant emoji",
  "category": "one of: sports, nature, space, music, gaming, food, luxury, retro, minimal, holiday",
  "tags": ["tag1", "tag2", "tag3"],
  "sentBubble": ["#HEXCOLOR1", "#HEXCOLOR2"],
  "receivedBubble": "#HEXCOLOR",
  "chatBackground": ["#HEXCOLOR1", "#HEXCOLOR2"],
  "accentColor": "#HEXCOLOR",
  "textOnSent": "#FFFFFF or #000000",
  "textOnReceived": "#FFFFFF or #000000",
  "bubbleShape": "rounded",
  "glowColor": "#HEXCOLOR or null"
}

Design rules:
- sentBubble is a 2-color gradient array for the user's outgoing messages
- receivedBubble is the background of received messages
- chatBackground is a full-screen 2-color gradient for the chat background
- accentColor is used for buttons, links, and timestamps
- textOnSent / textOnReceived must be readable on the respective backgrounds (#FFF or #000)
- glowColor adds a subtle glow effect to sent bubbles (can be null for no glow)
- Make the design cohesive, striking, and fit the theme
- For sports themes: use team colors, field/court colors
- For celebrity/athlete themes: use their team colors and era aesthetic
- Be creative but keep it readable`;

router.post("/generate", async (req, res) => {
  try {
    const { prompt } = req.body as { prompt?: string };
    if (!prompt || typeof prompt !== "string") {
      res.status(400).json({ error: "prompt is required" });
      return;
    }

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 8192,
      messages: [
        {
          role: "user",
          content: `Design a messaging app skin for this theme: "${prompt}"`,
        },
      ],
      system: SKIN_SYSTEM_PROMPT,
    });

    const block = message.content[0];
    if (block.type !== "text") {
      res.status(500).json({ error: "Unexpected AI response" });
      return;
    }

    let skinData: Record<string, unknown>;
    try {
      const cleaned = block.text.trim().replace(/^```json\s*/i, "").replace(/```\s*$/i, "");
      skinData = JSON.parse(cleaned);
    } catch {
      res.status(500).json({ error: "Failed to parse skin data", raw: block.text });
      return;
    }

    res.json({
      skin: {
        id: `ai-${Date.now()}`,
        creator: "ai",
        price: 0,
        ...skinData,
      },
    });
  } catch (err) {
    console.error("Skin generation error:", err);
    res.status(500).json({ error: "Skin generation failed" });
  }
});

export default router;
