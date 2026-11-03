import { z } from "zod";
import {
  MAX_CLIENT_ID_LENGTH,
  MAX_MESSAGE_TEXT_LENGTH,
  MAX_PROPOSAL_NOTE_LENGTH,
  MAX_PROPOSAL_TITLE_LENGTH,
  MAX_SLOT_LEAD_MS,
  MAX_SLOT_MS,
  SLOT_PAST_GRACE_MS,
  UUID_PATTERN,
} from "./limits.js";
import { normalizeAgentMedia, type NormalizedMedia } from "./media.js";

export type ParseOk<T> = { ok: true; value: T };
export type ParseFail = { ok: false; error: string };
export type ParseResult<T> = ParseOk<T> | ParseFail;

export type SendMessageInput = {
  chatId?: string;
  peerId?: string;
  text: string;
  clientId: string;
  media?: NormalizedMedia;
};

export type CalendarProposalInput = {
  chatId: string;
  title: string;
  startsAt: number;
  endsAt: number;
  note?: string;
  clientId: string;
};

export type ReadNewInput = { since?: number };

function fail(error: string): ParseFail {
  return { ok: false, error };
}

function issueText(error: z.ZodError): string {
  return error.issues.map((issue) => issue.message).join("; ");
}

function dropNulls(input: unknown): unknown {
  if (!input || typeof input !== "object" || Array.isArray(input)) return input;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value != null) out[key] = value;
  }
  return out;
}

function epochField(name: string) {
  return z.preprocess(
    (value) => (typeof value === "string" && /^-?\d+$/.test(value.trim()) ? Number(value.trim()) : value),
    z.number({ invalid_type_error: `${name} must be epoch milliseconds` })
      .int(`${name} must be epoch milliseconds`)
      .finite(`${name} must be epoch milliseconds`),
  );
}

function uuidField(name: string) {
  return z.string({
    required_error: `${name} must be a UUID`,
    invalid_type_error: `${name} must be a UUID`,
  }).regex(UUID_PATTERN, `${name} must be a UUID`);
}

const readNewSchema = z.object({
  since: z.preprocess(
    (value) => (typeof value === "string" && /^\d+$/.test(value.trim()) ? Number(value.trim()) : value),
    z.number({ invalid_type_error: "since must be an epoch millisecond cursor" })
      .int("since must be an epoch millisecond cursor")
      .nonnegative("since must be an epoch millisecond cursor")
      .optional(),
  ),
}).strict();

const sendMessageSchema = z.object({
  chatId: uuidField("chatId").optional(),
  peerId: uuidField("peerId").optional(),
  text: z.string({ invalid_type_error: "text must be a string" }).max(
    MAX_MESSAGE_TEXT_LENGTH,
    `text must be at most ${MAX_MESSAGE_TEXT_LENGTH} characters`,
  ).optional(),
  clientId: z.string({
    required_error: "clientId is required",
    invalid_type_error: "clientId is required",
  }).trim().min(1, "clientId is required").max(MAX_CLIENT_ID_LENGTH, `clientId must be at most ${MAX_CLIENT_ID_LENGTH} characters`),
  media: z.unknown().optional(),
}).strict().superRefine((value, ctx) => {
  if ((value.chatId == null) === (value.peerId == null)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Provide exactly one of chatId or peerId" });
  }
});

const calendarSchema = z.object({
  chatId: uuidField("chatId"),
  title: z.string({
    required_error: "title is required",
    invalid_type_error: "title is required",
  }).trim().min(1, "title is required").max(MAX_PROPOSAL_TITLE_LENGTH, "title is too long"),
  startsAt: epochField("startsAt"),
  endsAt: epochField("endsAt"),
  note: z.string({ invalid_type_error: "note is too long" }).trim().max(MAX_PROPOSAL_NOTE_LENGTH, "note is too long").optional(),
  clientId: z.string({
    required_error: "clientId is required",
    invalid_type_error: "clientId is required",
  }).trim().min(1, "clientId is required").max(MAX_CLIENT_ID_LENGTH, `clientId must be at most ${MAX_CLIENT_ID_LENGTH} characters`),
}).strict();

export function parseReadNewArgs(input: unknown): ParseResult<ReadNewInput> {
  const parsed = readNewSchema.safeParse(dropNulls(input ?? {}));
  if (!parsed.success) return fail(issueText(parsed.error));
  return { ok: true, value: parsed.data.since == null ? {} : { since: parsed.data.since } };
}

export function parseSendMessageArgs(input: unknown): ParseResult<SendMessageInput> {
  const record = dropNulls(input);
  if (record == null || typeof record !== "object" || Array.isArray(record)) return fail("Arguments must be an object");
  const parsed = sendMessageSchema.safeParse(record);
  if (!parsed.success) return fail(issueText(parsed.error));
  let media: NormalizedMedia | undefined;
  if (parsed.data.media != null) {
    const normalized = normalizeAgentMedia(parsed.data.media);
    if (!normalized.ok) return normalized;
    media = normalized.media;
  }
  const raw = parsed.data.text ?? "";
  if (!raw.trim() && !media) return fail("text or an image/PDF is required");
  const text = media ? raw.trim() : raw;
  return {
    ok: true,
    value: {
      ...(parsed.data.chatId ? { chatId: parsed.data.chatId } : {}),
      ...(parsed.data.peerId ? { peerId: parsed.data.peerId } : {}),
      text,
      clientId: parsed.data.clientId,
      ...(media ? { media } : {}),
    },
  };
}

export function validateProposalSlot(
  startsAt: number,
  endsAt: number,
  now: number,
): { ok: true } | { ok: false; error: string } {
  if (endsAt <= startsAt) return { ok: false, error: "The slot must end after it starts" };
  if (endsAt - startsAt > MAX_SLOT_MS) return { ok: false, error: "The slot is too long" };
  if (startsAt < now - SLOT_PAST_GRACE_MS) return { ok: false, error: "The slot is in the past" };
  if (startsAt > now + MAX_SLOT_LEAD_MS) return { ok: false, error: "The slot is too far in the future" };
  return { ok: true };
}

export function parseCalendarProposeArgs(input: unknown, now = Date.now()): ParseResult<CalendarProposalInput> {
  const record = dropNulls(input);
  if (record == null || typeof record !== "object" || Array.isArray(record)) return fail("Arguments must be an object");
  if ("peerId" in record) {
    return fail("Calendar proposals need chatId. Use zivr_send_message with peerId to open a same-owner DM.");
  }
  const parsed = calendarSchema.safeParse(record);
  if (!parsed.success) return fail(issueText(parsed.error));
  const slot = validateProposalSlot(parsed.data.startsAt, parsed.data.endsAt, now);
  if (!slot.ok) return slot;
  const note = parsed.data.note?.trim();
  return {
    ok: true,
    value: {
      chatId: parsed.data.chatId,
      title: parsed.data.title,
      startsAt: parsed.data.startsAt,
      endsAt: parsed.data.endsAt,
      clientId: parsed.data.clientId,
      ...(note ? { note } : {}),
    },
  };
}
