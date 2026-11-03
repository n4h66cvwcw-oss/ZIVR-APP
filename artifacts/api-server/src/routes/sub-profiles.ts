import { Router } from "express";
import { getAuthUserId } from "../lib/auth";
import { sendFailure } from "../lib/agent-http";
import {
  addAgentToChat,
  clearWebhook,
  createSubProfile,
  deleteSubProfile,
  deliverSubProfileMessage,
  listApiKeys,
  listSubProfiles,
  mintApiKey,
  removeAgentFromChat,
  revokeApiKey,
  setWebhook,
  updateSubProfile,
  upgradeSubProfile,
} from "../lib/agent-delivery";

const router = Router();

function ownerId(req: Parameters<typeof getAuthUserId>[0]): string | null {
  return getAuthUserId(req);
}

router.post("/", async (req, res) => {
  try {
    const userId = ownerId(req);
    if (!userId) { sendFailure(res, { ok: false, status: 401, error: "Invalid or missing auth token", code: "auth" }); return; }
    const result = await createSubProfile(userId, req.body);
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(201).json({ subProfile: result.subProfile });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "error" });
  }
});

router.get("/", async (req, res) => {
  try {
    const userId = ownerId(req);
    if (!userId) { sendFailure(res, { ok: false, status: 401, error: "Invalid or missing auth token", code: "auth" }); return; }
    const subProfiles = await listSubProfiles(userId);
    res.json({ subProfiles });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "error" });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const userId = ownerId(req);
    if (!userId) { sendFailure(res, { ok: false, status: 401, error: "Invalid or missing auth token", code: "auth" }); return; }
    const result = await updateSubProfile(userId, req.params.id, req.body);
    if (!result.ok) { sendFailure(res, result); return; }
    res.json({ subProfile: result.subProfile });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "error" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const userId = ownerId(req);
    if (!userId) { sendFailure(res, { ok: false, status: 401, error: "Invalid or missing auth token", code: "auth" }); return; }
    const result = await deleteSubProfile(userId, req.params.id);
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "error" });
  }
});

router.post("/:id/upgrade", async (req, res) => {
  try {
    const userId = ownerId(req);
    if (!userId) { sendFailure(res, { ok: false, status: 401, error: "Invalid or missing auth token", code: "auth" }); return; }
    const result = await upgradeSubProfile(userId, req.params.id, req.body);
    if (!result.ok) { sendFailure(res, result); return; }
    res.json({ subProfile: result.subProfile });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "error" });
  }
});

router.post("/:id/keys", async (req, res) => {
  try {
    const userId = ownerId(req);
    if (!userId) { sendFailure(res, { ok: false, status: 401, error: "Invalid or missing auth token", code: "auth" }); return; }
    const result = await mintApiKey(userId, req.params.id, req.body);
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(201).json({ key: result.key, credential: result.credential });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "error" });
  }
});

router.get("/:id/keys", async (req, res) => {
  try {
    const userId = ownerId(req);
    if (!userId) { sendFailure(res, { ok: false, status: 401, error: "Invalid or missing auth token", code: "auth" }); return; }
    const result = await listApiKeys(userId, req.params.id);
    if (!result.ok) { sendFailure(res, result); return; }
    res.json({ keys: result.keys });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "error" });
  }
});

router.delete("/:id/keys/:keyId", async (req, res) => {
  try {
    const userId = ownerId(req);
    if (!userId) { sendFailure(res, { ok: false, status: 401, error: "Invalid or missing auth token", code: "auth" }); return; }
    const result = await revokeApiKey(userId, req.params.id, req.params.keyId);
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "error" });
  }
});

router.put("/:id/webhook", async (req, res) => {
  try {
    const userId = ownerId(req);
    if (!userId) { sendFailure(res, { ok: false, status: 401, error: "Invalid or missing auth token", code: "auth" }); return; }
    const result = await setWebhook(userId, req.params.id, req.body);
    if (!result.ok) { sendFailure(res, result); return; }
    res.json({ webhook: result.webhook });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "error" });
  }
});

router.delete("/:id/webhook", async (req, res) => {
  try {
    const userId = ownerId(req);
    if (!userId) { sendFailure(res, { ok: false, status: 401, error: "Invalid or missing auth token", code: "auth" }); return; }
    const result = await clearWebhook(userId, req.params.id);
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "error" });
  }
});

router.post("/:id/chats/:chatId", async (req, res) => {
  try {
    const userId = ownerId(req);
    if (!userId) { sendFailure(res, { ok: false, status: 401, error: "Invalid or missing auth token", code: "auth" }); return; }
    const result = await addAgentToChat(userId, req.params.id, req.params.chatId);
    if (!result.ok) { sendFailure(res, result); return; }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "error" });
  }
});

router.delete("/:id/chats/:chatId", async (req, res) => {
  try {
    const userId = ownerId(req);
    if (!userId) { sendFailure(res, { ok: false, status: 401, error: "Invalid or missing auth token", code: "auth" }); return; }
    const result = await removeAgentFromChat(userId, req.params.id, req.params.chatId);
    if (!result.ok) { sendFailure(res, result); return; }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "error" });
  }
});

router.post("/:id/messages", async (req, res) => {
  try {
    const userId = ownerId(req);
    if (!userId) { sendFailure(res, { ok: false, status: 401, error: "Invalid or missing auth token", code: "auth" }); return; }
    const body = req.body && typeof req.body === "object" ? req.body as Record<string, unknown> : {};
    const result = await deliverSubProfileMessage({
      profileId: req.params.id,
      actorUserId: userId,
      chatId: typeof body["chatId"] === "string" ? body["chatId"] : "",
      clientId: body["clientId"],
      text: body["text"],
      type: body["type"],
      media: body["media"],
      mode: "owner_send_as",
    });
    if (!result.ok) { sendFailure(res, result); return; }
    res.json({ message: result.message });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "error" });
  }
});

export default router;
