import type { Response } from "express";
import type { Gate } from "./agent-policy";

export function sendFailure(res: Response, gate: Gate): void {
  if (gate.retryAfter != null) res.setHeader("Retry-After", String(gate.retryAfter));
  res.status(gate.status).json({ error: gate.error, code: gate.code });
}
