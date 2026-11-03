import { Router } from "express";
import { getAuthUserId } from "../lib/auth";
import { sendFailure } from "../lib/agent-http";
import { respondToCalendarProposal } from "../lib/agent-delivery";

const router = Router();

/**
 * Owner or chat-admin Yes/No for a slot card.
 * Yes asks the main profile calendar to create the event.
 * No dismisses the card. There is no member tally.
 */
router.post("/:proposalId/respond", async (req, res) => {
  try {
    const callerId = getAuthUserId(req);
    if (!callerId) {
      sendFailure(res, { ok: false, status: 401, error: "Invalid or missing auth token", code: "auth" });
      return;
    }
    const body = req.body && typeof req.body === "object" ? req.body as Record<string, unknown> : {};
    const result = await respondToCalendarProposal({
      callerId,
      proposalId: req.params.proposalId,
      decision: body["decision"],
    });
    if (!result.ok) { sendFailure(res, result); return; }
    res.json({
      proposal: result.proposal,
      role: result.role,
      calendarWrite: result.calendarWrite,
      ...(result.todo ? { todo: result.todo } : {}),
      idempotent: result.idempotent,
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "error" });
  }
});

export default router;
