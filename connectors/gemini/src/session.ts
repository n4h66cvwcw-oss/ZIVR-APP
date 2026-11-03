import {
  BRIDGE_INSTRUCTIONS,
  MAX_INLINE_FILES,
  MAX_TOOL_STEPS,
  ZIVR_FUNCTIONS,
  createToolMemory,
  executeZivrTool,
  type AttachmentStash,
  type PromptFile,
  type TurnInput,
  type TurnResult,
  type ZivrAgentApi,
} from "@workspace/zivr-agent-client";
import { GeminiClient, geminiCalls, geminiText, type GeminiContent } from "./gemini.js";

const INLINE_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
  "application/pdf",
]);

function inlineParts(files: PromptFile[]): Array<{ inlineData: { mimeType: string; data: string } }> {
  const parts = [];
  for (const file of files) {
    if (!INLINE_MIME.has(file.mimeType)) continue;
    parts.push({ inlineData: { mimeType: file.mimeType, data: file.base64 } });
    if (parts.length >= MAX_INLINE_FILES) break;
  }
  return parts;
}

/**
 * Local Gemini transcript. Each turn is one or more generateContent calls.
 * Google does not execute the declared functions and does not push ZIVR events here.
 */
export class GeminiSession {
  private readonly contents: GeminiContent[] = [];
  private readonly memory = createToolMemory();

  constructor(
    private readonly gemini: GeminiClient,
    private readonly zivr: ZivrAgentApi,
    private readonly stash: AttachmentStash,
    private readonly now?: () => number,
  ) {}

  async runTurn(input: TurnInput): Promise<TurnResult> {
    const parts: unknown[] = [{ text: input.text }, ...inlineParts(input.files)];
    this.contents.push({ role: "user", parts });
    let toolCalls = 0;
    let sends = 0;
    for (let step = 0; step < MAX_TOOL_STEPS; step += 1) {
      const content = await this.gemini.generate({
        systemInstruction: { parts: [{ text: BRIDGE_INSTRUCTIONS }] },
        contents: this.contents,
        tools: [{ functionDeclarations: ZIVR_FUNCTIONS }],
      });
      this.contents.push(content);
      const calls = geminiCalls(content);
      if (calls.length === 0) return { text: geminiText(content), toolCalls, sends };
      const responseParts: unknown[] = [];
      for (const call of calls) {
        toolCalls += 1;
        const outcome = await executeZivrTool(call.name, call.args, {
          zivr: this.zivr,
          stash: this.stash,
          memory: this.memory,
          ...(this.now ? { now: this.now } : {}),
        });
        if (call.name === "zivr_send_message" && outcome.result["ok"] === true) sends += 1;
        const attached = inlineParts(outcome.files);
        responseParts.push({
          functionResponse: {
            name: call.name,
            ...(call.id ? { id: call.id } : {}),
            response: outcome.result,
            ...(attached.length > 0 ? { parts: attached } : {}),
          },
        });
      }
      this.contents.push({ role: "user", parts: responseParts });
    }
    return { text: "Stopped after the tool-call limit.", toolCalls, sends };
  }
}
