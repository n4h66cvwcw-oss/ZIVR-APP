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
import { PerplexityClient, perplexityCalls, perplexityText, type PerplexityItem } from "./perplexity.js";

const IMAGE_MIME = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

const FILE_MIME = new Set([
  "application/pdf",
  "text/plain",
  "application/rtf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const FILE_EXTENSION: Record<string, string> = {
  "application/pdf": "pdf",
  "text/plain": "txt",
  "application/rtf": "rtf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
};

function fileNameFor(file: PromptFile): string {
  if (file.fileName) return file.fileName;
  const ext = FILE_EXTENSION[file.mimeType] ?? "bin";
  return `attachment.${ext}`;
}

/**
 * Perplexity custom-function outputs are strings. Image and document bytes go on a
 * following user message, which is the Agent API's input_image / input_file shape.
 */
export function perplexityUserContent(text: string, files: PromptFile[]): PerplexityItem {
  const content: unknown[] = [{ type: "input_text", text }];
  let attached = 0;
  for (const file of files) {
    if (attached >= MAX_INLINE_FILES) break;
    if (IMAGE_MIME.has(file.mimeType)) {
      content.push({ type: "input_image", image_url: `data:${file.mimeType};base64,${file.base64}` });
      attached += 1;
      continue;
    }
    if (FILE_MIME.has(file.mimeType)) {
      content.push({
        type: "input_file",
        filename: fileNameFor(file),
        file_data: `data:${file.mimeType};base64,${file.base64}`,
      });
      attached += 1;
    }
  }
  return { type: "message", role: "user", content };
}

function toolList(): PerplexityItem[] {
  return ZIVR_FUNCTIONS.map((fn) => ({
    type: "function",
    name: fn.name,
    description: fn.description,
    parameters: fn.parameters,
    strict: false,
  }));
}

export class PerplexitySession {
  private readonly input: PerplexityItem[] = [];
  private readonly memory = createToolMemory();

  constructor(
    private readonly perplexity: PerplexityClient,
    private readonly zivr: ZivrAgentApi,
    private readonly stash: AttachmentStash,
    private readonly now?: () => number,
  ) {}

  async runTurn(input: TurnInput): Promise<TurnResult> {
    this.input.push(perplexityUserContent(input.text, input.files));
    let toolCalls = 0;
    let sends = 0;
    for (let step = 0; step < MAX_TOOL_STEPS; step += 1) {
      const output = await this.perplexity.respond(this.input, toolList(), BRIDGE_INSTRUCTIONS);
      for (const item of output) this.input.push(item);
      const calls = perplexityCalls(output);
      if (calls.length === 0) return { text: perplexityText(output), toolCalls, sends };
      const files: PromptFile[] = [];
      for (const call of calls) {
        toolCalls += 1;
        let args: unknown = {};
        try {
          args = JSON.parse(call.arguments) as unknown;
        } catch {
          args = {};
        }
        const outcome = await executeZivrTool(call.name, args, {
          zivr: this.zivr,
          stash: this.stash,
          memory: this.memory,
          ...(this.now ? { now: this.now } : {}),
        });
        if (call.name === "zivr_send_message" && outcome.result["ok"] === true) sends += 1;
        files.push(...outcome.files);
        this.input.push({
          type: "function_call_output",
          call_id: call.callId,
          output: JSON.stringify(outcome.result),
        });
      }
      if (files.length > 0) {
        this.input.push(perplexityUserContent(
          "These files belong to the tool result above. Continue from that result.",
          files,
        ));
      }
    }
    return { text: "Stopped after the tool-call limit.", toolCalls, sends };
  }
}
