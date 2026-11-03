import { Router } from "express";
import { sendFailure } from "../lib/agent-http";
import { readOwnerFreeBusy } from "../lib/agent-calendar";
import { looksLikeApiKey } from "../lib/agent-crypto";
import {
  createCalendarProposal,
  deliverSubProfileMessage,
  exchangeAgentToken,
  getProposalForAgent,
  listAgentChats,
  listAgentEvents,
  openSameOwnerAgentDirect,
  requireAgent,
} from "../lib/agent-delivery";

const router = Router();

function bearer(header: string | undefined): string | null {
  const match = /^Bearer\s+(\S+)$/i.exec(header?.trim() ?? "");
  return match?.[1] ?? null;
}

router.post("/token", async (req, res) => {
  try {
    const body = req.body && typeof req.body === "object" ? req.body as Record<string, unknown> : {};
    const fromBody = typeof body["apiKey"] === "string" ? body["apiKey"] : "";
    const fromHeader = bearer(req.header("authorization")) ?? "";
    if (fromHeader && !looksLikeApiKey(fromHeader) && !fromBody) {
      sendFailure(res, { ok: false, status: 400, error: "Exchange an API key, not an access token", code: "invalid" });
      return;
    }
    const apiKey = fromBody || fromHeader;
    const result = await exchangeAgentToken(apiKey);
    if (!result.ok) { sendFailure(res, result); return; }
    res.json({
      accessToken: result.accessToken,
      tokenType: result.tokenType,
      expiresIn: result.expiresIn,
      agentUserId: result.agentUserId,
      ownerUserId: result.ownerUserId,
      scopes: result.scopes,
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "error" });
  }
});

router.post("/messages", async (req, res) => {
  try {
    const auth = await requireAgent(req.header("authorization"), "messages:send");
    if (!auth.ok) { sendFailure(res, auth); return; }
    const body = req.body && typeof req.body === "object" ? req.body as Record<string, unknown> : {};
    const media = body["media"];
    const hasMedia = media != null && !(Array.isArray(media) && media.length === 0);
    if (hasMedia && !auth.claims.scopes.includes("media:send")) {
      sendFailure(res, { ok: false, status: 403, error: "Missing scope media:send", code: "scope" });
      return;
    }
    let chatId = typeof body["chatId"] === "string" ? body["chatId"] : "";
    if (!chatId && typeof body["peerId"] === "string") {
      const opened = await openSameOwnerAgentDirect(auth.actor.id, body["peerId"]);
      if (!opened.ok) { sendFailure(res, opened); return; }
      chatId = opened.chatId;
    }
    const result = await deliverSubProfileMessage({
      profileId: auth.actor.id,
      actorUserId: auth.actor.id,
      chatId,
      clientId: body["clientId"],
      text: body["text"],
      type: body["type"],
      media,
      mode: "agent_api",
    });
    if (!result.ok) { sendFailure(res, result); return; }
    res.json({ message: result.message });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "error" });
  }
});

router.get("/chats", async (req, res) => {
  try {
    const auth = await requireAgent(req.header("authorization"), "chats:list");
    if (!auth.ok) { sendFailure(res, auth); return; }
    const chats = await listAgentChats(auth.actor.id);
    res.json({ chats });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "error" });
  }
});

router.get("/events", async (req, res) => {
  try {
    const auth = await requireAgent(req.header("authorization"), "messages:read");
    if (!auth.ok) { sendFailure(res, auth); return; }
    const sinceRaw = req.query["since"];
    const since = typeof sinceRaw === "string" && sinceRaw.length > 0 ? Number(sinceRaw) : 0;
    if (!Number.isFinite(since) || since < 0) {
      sendFailure(res, { ok: false, status: 400, error: "since must be an epoch millisecond cursor", code: "invalid" });
      return;
    }
    const events = await listAgentEvents(auth.actor.id, since);
    const nextSince = events.length > 0 ? events[events.length - 1]!.createdAt : since;
    res.json({ events: events.map((message) => ({ type: "message.created", message })), nextSince });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "error" });
  }
});

router.get("/calendar/free-busy", async (req, res) => {
  try {
    const auth = await requireAgent(req.header("authorization"), "calendar:read");
    if (!auth.ok) { sendFailure(res, auth); return; }
    const start = typeof req.query["start"] === "string" ? Number(req.query["start"]) : null;
    const end = typeof req.query["end"] === "string" ? Number(req.query["end"]) : null;
    if ((start != null && !Number.isFinite(start)) || (end != null && !Number.isFinite(end))) {
      sendFailure(res, { ok: false, status: 400, error: "start and end must be epoch milliseconds", code: "invalid" });
      return;
    }
    const busy = await readOwnerFreeBusy(auth.claims.owner, start, end);
    res.json(busy);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "error" });
  }
});

router.post("/calendar/proposals", async (req, res) => {
  try {
    const auth = await requireAgent(req.header("authorization"), "calendar:propose");
    if (!auth.ok) { sendFailure(res, auth); return; }
    const body = req.body && typeof req.body === "object" ? req.body as Record<string, unknown> : {};
    const result = await createCalendarProposal({
      agentUserId: auth.actor.id,
      chatId: body["chatId"],
      title: body["title"],
      startsAt: body["startsAt"],
      endsAt: body["endsAt"],
      note: body["note"],
      clientId: body["clientId"],
    });
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(result.duplicate ? 200 : 201).json({ proposal: result.proposal, message: result.message });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "error" });
  }
});

router.get("/calendar/proposals/:proposalId", async (req, res) => {
  try {
    const auth = await requireAgent(req.header("authorization"), "calendar:propose");
    if (!auth.ok && auth.code === "scope") {
      const read = await requireAgent(req.header("authorization"), "calendar:read");
      if (!read.ok) { sendFailure(res, read); return; }
      const proposal = await getProposalForAgent(read.actor.id, req.params.proposalId);
      if (!proposal) { sendFailure(res, { ok: false, status: 404, error: "Proposal not found", "code": "not_found" }); return; }
      res.json({ proposal });
      return;
    }
    if (!auth.ok) { sendFailure(res, auth); return; }
    const proposal = await getProposalForAgent(auth.actor.id, req.params.proposalId);
    if (!proposal) { sendFailure(res, { ok: false, status: 404, error: "Proposal not found", code: "not_found" }); return; }
    res.json({ proposal });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "error" });
  }
});

export default router;
