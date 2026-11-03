export type ExpoPushPriority = "default" | "normal" | "high";

export type ExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  sound?: "default";
  data: Record<string, unknown>;
  categoryId?: string;
  priority: ExpoPushPriority;
};

export type ExpoPushTicket = {
  status?: string;
  id?: string;
  message?: string;
  details?: { error?: string };
};

export type ExpoPushRequestError = {
  code?: string;
  message?: string;
};

export type ExpoPushReceipt = {
  httpStatus: number;
  tickets: ExpoPushTicket[];
  requestErrors: ExpoPushRequestError[];
  invalidCredentials: boolean;
};

export function messagePushData(chatId: string, messageId: string): Record<string, string> {
  return { chatId, messageId };
}

export function buildExpoPushMessages(
  tokens: string[],
  title: string,
  body: string,
  sound: string,
  data: Record<string, unknown> = {},
  categoryId?: string,
  priority: ExpoPushPriority = "high",
): ExpoPushMessage[] {
  return tokens.map((to) => {
    const message: ExpoPushMessage = {
      to,
      title,
      body,
      sound: sound === "none" ? undefined : "default",
      data: { sound, ...data },
      priority,
    };
    if (categoryId) message.categoryId = categoryId;
    return message;
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function errorCode(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function readExpoPushResult(httpStatus: number, body: unknown): ExpoPushReceipt {
  const root = isRecord(body) ? body : {};
  const requestErrors: ExpoPushRequestError[] = Array.isArray(root["errors"])
    ? root["errors"].filter(isRecord).map((err) => ({
        code: errorCode(err["code"]),
        message: errorCode(err["message"]),
      }))
    : [];
  const rawTickets = Array.isArray(root["data"])
    ? root["data"]
    : isRecord(root["data"])
      ? [root["data"]]
      : [];
  const tickets: ExpoPushTicket[] = rawTickets.filter(isRecord).map((ticket) => {
    const details = isRecord(ticket["details"]) ? ticket["details"] : undefined;
    const error = details ? errorCode(details["error"]) : undefined;
    return {
      status: errorCode(ticket["status"]),
      id: errorCode(ticket["id"]),
      message: errorCode(ticket["message"]),
      details: error ? { error } : undefined,
    };
  });
  const invalidCredentials = tickets.some((ticket) => ticket.details?.error === "InvalidCredentials")
    || requestErrors.some((err) =>
      err.code === "InvalidCredentials" || (err.message ?? "").includes("InvalidCredentials"));
  return { httpStatus, tickets, requestErrors, invalidCredentials };
}

/** Log ticket ids and Expo error codes. Push tokens and message text are omitted. */
export function logExpoPushResult(receipt: ExpoPushReceipt): void {
  const errorTickets = receipt.tickets.filter((ticket) => ticket.status === "error");
  const summary = {
    httpStatus: receipt.httpStatus,
    tickets: receipt.tickets.length,
    ok: receipt.tickets.length - errorTickets.length,
    errors: errorTickets.length,
    requestErrors: receipt.requestErrors,
    invalidCredentials: receipt.invalidCredentials,
    errorTickets: errorTickets.map((ticket) => ({
      id: ticket.id,
      message: ticket.message,
      error: ticket.details?.error,
    })),
    ticketIds: receipt.tickets.map((ticket) => ticket.id).filter((id): id is string => !!id),
  };
  const line = `${receipt.invalidCredentials ? "InvalidCredentials " : ""}${JSON.stringify(summary)}`;
  if (receipt.invalidCredentials || receipt.httpStatus >= 400 || errorTickets.length > 0 || receipt.requestErrors.length > 0) {
    console.error(`[push] Expo ticket error ${line}`);
    return;
  }
  console.info(`[push] Expo tickets ${line}`);
}

export async function sendExpoPush(
  tokens: string[],
  title: string,
  body: string,
  sound: string,
  data: Record<string, unknown> = {},
  categoryId?: string,
  priority: ExpoPushPriority = "high",
): Promise<ExpoPushReceipt | null> {
  if (!tokens.length) return null;
  const messages = buildExpoPushMessages(tokens, title, body, sound, data, categoryId, priority);
  try {
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(messages),
    });
    const payload: unknown = await response.json().catch(() => null);
    const receipt = readExpoPushResult(response.status, payload);
    logExpoPushResult(receipt);
    return receipt;
  } catch (err) {
    console.error("[push] failed to send:", err);
    return null;
  }
}
