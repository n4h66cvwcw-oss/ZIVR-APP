export const REPORT_REASONS = ["spam", "harassment", "inappropriate", "other"] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

export type BlockedUser = {
  userId: string;
  displayName: string;
  username?: string | null;
  avatar?: string | null;
  createdAt: number;
};

export type ReportInput = {
  reportedUserId: string;
  messageId?: string | null;
  chatId?: string | null;
  reason: ReportReason;
  details?: string | null;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isServerUuid(value: string | undefined | null): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export function directChatHiddenByBlock(
  type: string,
  participantIds: readonly string[],
  myId: string,
  blockedIds: ReadonlySet<string>,
): boolean {
  if (type !== "direct") return false;
  return participantIds.some((id) => id !== myId && blockedIds.has(id));
}

export function messageHiddenForBlocker(senderId: string, blockedIds: ReadonlySet<string>): boolean {
  return blockedIds.has(senderId);
}

/** Drop ids that are not server uuids so a local-only chat can still report the user. */
export function reportRequestBody(input: ReportInput): ReportInput {
  return {
    reportedUserId: input.reportedUserId,
    reason: input.reason,
    ...(isServerUuid(input.messageId) ? { messageId: input.messageId } : {}),
    ...(isServerUuid(input.chatId) ? { chatId: input.chatId } : {}),
    ...(input.details?.trim() ? { details: input.details.trim() } : {}),
  };
}

type Headers = Record<string, string>;

async function readError(res: Response): Promise<string> {
  const body = await res.json().catch(() => ({})) as { error?: string };
  return body.error || "Request failed";
}

export async function createReport(
  baseUrl: string,
  headers: Headers,
  input: ReportInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await fetch(`${baseUrl}/reports`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(reportRequestBody(input)),
  });
  if (!res.ok) return { ok: false, error: await readError(res) };
  return { ok: true };
}

export async function createBlock(
  baseUrl: string,
  headers: Headers,
  userId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await fetch(`${baseUrl}/blocks`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({ userId }),
  });
  if (!res.ok) return { ok: false, error: await readError(res) };
  return { ok: true };
}

export async function removeBlock(
  baseUrl: string,
  headers: Headers,
  userId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await fetch(`${baseUrl}/blocks/${encodeURIComponent(userId)}`, {
    method: "DELETE",
    headers,
  });
  if (!res.ok) return { ok: false, error: await readError(res) };
  return { ok: true };
}

export async function fetchBlocks(baseUrl: string, headers: Headers): Promise<BlockedUser[] | null> {
  const res = await fetch(`${baseUrl}/blocks`, { headers });
  if (!res.ok) return null;
  const data = await res.json() as { blocks?: BlockedUser[] };
  return data.blocks ?? [];
}
