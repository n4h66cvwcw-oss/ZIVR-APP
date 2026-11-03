import pool, { query, queryOne } from "./db";
import { fanoutMessage, pushTokensForChat } from "./realtime-bus";
import { sendExpoPush } from "./push";
import {
  calendarProposalCard,
  mediaJsonParam,
  messagePreview,
  prepareAgentOutgoingMessage,
  serializedMessageFromRow,
  type SerializedMessage,
} from "./message-content";
import {
  assistantLabel,
  calendarProposeEnabled,
  canDecideProposal,
  chatAllowsAgent,
  hasScope,
  looksLikeDeviceCiphertext,
  MAX_AGENTS_PER_OWNER,
  nextProposalStatus,
  ownerMayCreateSubProfile,
  parseAvatar,
  parseClientId,
  parseDisplayName,
  DEFAULT_AGENT_KEY_SCOPES,
  parseProfileMode,
  parseProposalNote,
  parseProposalTitle,
  parseProvider,
  parseScopes,
  parseUsername,
  parseUuid,
  parseWebhookUrl,
  proposalDecisionText,
  proposalSummary,
  rateLimitDecision,
  utcDayStart,
  validateProposalSlot,
  type AgentScope,
  type Gate,
  type ProposalStatus,
} from "./agent-policy";
import {
  generateApiKey,
  generateWebhookSecret,
  hashApiKey,
  looksLikeApiKey,
  openSecret,
  signAgentToken,
  signWebhookBody,
  verifyAgentToken,
  type AgentTokenClaims,
} from "./agent-crypto";
import { writeMainProfileCalendarEvent } from "./agent-calendar";

type ActorRow = {
  id: string;
  display_name: string;
  username: string | null;
  avatar: string | null;
  account_type: string | null;
  owner_user_id: string | null;
  profile_mode: string | null;
  agent_provider: string | null;
  agent_status: string | null;
  supervised: boolean;
  created_at: string | number;
};

export type Actor = {
  id: string;
  displayName: string;
  username: string | null;
  avatar: string | null;
  accountType: string;
  ownerUserId: string | null;
  profileMode: "persona" | "agent" | null;
  agentProvider: string | null;
  agentStatus: "active" | "paused" | "revoked" | null;
  supervised: boolean;
  createdAt: number;
};

export type PublicSubProfile = {
  id: string;
  displayName: string;
  username: string | null;
  avatar: string | null;
  profileMode: "persona" | "agent";
  provider: string | null;
  status: "active" | "paused" | "revoked";
  ownerUserId: string;
  assistantLabel: string;
  createdAt: number;
};

type ChatGateRow = {
  id: string;
  type: string;
  created_by: string | null;
  is_e2e: boolean;
  has_e2e_message: boolean;
  has_child: boolean;
};

export type ChatGate = {
  id: string;
  type: string;
  createdBy: string | null;
  isE2e: boolean;
  hasE2eMessage: boolean;
  hasChild: boolean;
};

function fail(status: number, error: string, code: string, retryAfter?: number): Gate {
  return retryAfter == null ? { ok: false, status, error, code } : { ok: false, status, error, code, retryAfter };
}

function mapActor(row: ActorRow): Actor {
  const mode = row.profile_mode === "persona" || row.profile_mode === "agent" ? row.profile_mode : null;
  const status = row.agent_status === "active" || row.agent_status === "paused" || row.agent_status === "revoked"
    ? row.agent_status
    : null;
  return {
    id: row.id,
    displayName: row.display_name,
    username: row.username,
    avatar: row.avatar,
    accountType: row.account_type ?? "standard",
    ownerUserId: row.owner_user_id,
    profileMode: mode,
    agentProvider: row.agent_provider,
    agentStatus: status,
    supervised: row.supervised === true,
    createdAt: Number(row.created_at) || 0,
  };
}

const ACTOR_SQL = `
  SELECT u.id, u.display_name, u.username, u.avatar, u.account_type, u.owner_user_id,
         u.profile_mode, u.agent_provider, u.agent_status, u.created_at,
         EXISTS (SELECT 1 FROM vm_parent_child pc WHERE pc.child_id = u.id) AS supervised
    FROM vm_users u
`;

export async function loadActor(userId: string): Promise<Actor | null> {
  const row = await queryOne<ActorRow>(`${ACTOR_SQL} WHERE u.id = $1`, [userId]);
  return row ? mapActor(row) : null;
}

export async function audit(
  agentUserId: string,
  action: string,
  chatId: string | null = null,
  detail: Record<string, unknown> | null = null,
): Promise<void> {
  try {
    await query(
      `INSERT INTO vm_agent_audit (agent_user_id, action, chat_id, detail, at)
       VALUES ($1, $2, $3, $4::jsonb, $5)`,
      [agentUserId, action, chatId, detail ? JSON.stringify(detail) : null, Date.now()],
    );
  } catch {
    /* audit must not block the caller */
  }
}

export function toPublicSubProfile(actor: Actor, ownerDisplayName: string): PublicSubProfile | null {
  if (actor.accountType !== "agent" || !actor.ownerUserId || !actor.profileMode || !actor.agentStatus) return null;
  return {
    id: actor.id,
    displayName: actor.displayName,
    username: actor.username,
    avatar: actor.avatar,
    profileMode: actor.profileMode,
    provider: actor.agentProvider,
    status: actor.agentStatus,
    ownerUserId: actor.ownerUserId,
    assistantLabel: assistantLabel(ownerDisplayName),
    createdAt: actor.createdAt,
  };
}

async function ownerName(ownerUserId: string): Promise<string> {
  const row = await queryOne<{ display_name: string }>(
    `SELECT display_name FROM vm_users WHERE id = $1`,
    [ownerUserId],
  );
  return row?.display_name ?? "Owner";
}

export async function listSubProfiles(ownerUserId: string): Promise<PublicSubProfile[]> {
  const rows = await query<ActorRow & { owner_display_name: string }>(
    `SELECT a.id, a.display_name, a.username, a.avatar, a.account_type, a.owner_user_id,
            a.profile_mode, a.agent_provider, a.agent_status, a.created_at,
            false AS supervised, o.display_name AS owner_display_name
       FROM vm_users a
       JOIN vm_users o ON o.id = a.owner_user_id
      WHERE a.owner_user_id = $1 AND a.account_type = 'agent'
      ORDER BY a.created_at ASC`,
    [ownerUserId],
  );
  return rows.flatMap((row) => {
    const pub = toPublicSubProfile(mapActor(row), row.owner_display_name);
    return pub ? [pub] : [];
  });
}

export async function createSubProfile(ownerUserId: string, body: unknown): Promise<
  { ok: true; subProfile: PublicSubProfile } | Gate
> {
  const owner = await loadActor(ownerUserId);
  if (!owner) return fail(401, "Invalid or missing auth token", "auth");
  const allowed = ownerMayCreateSubProfile(owner);
  if (!allowed.ok) return allowed;
  const record = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const profileMode = parseProfileMode(record["profileMode"]);
  if (!profileMode) return fail(400, "profileMode must be persona or agent", "invalid");
  const displayName = parseDisplayName(record["displayName"]);
  if (!displayName) return fail(400, "displayName is required", "invalid");
  const username = parseUsername(record["username"]);
  if (username === undefined) return fail(400, "username must be 3-32 letters, numbers, or underscores", "invalid");
  const provider = parseProvider(record["provider"], profileMode);
  if (provider === undefined) {
    return fail(400, profileMode === "persona"
      ? "Persona profiles do not take a provider"
      : "provider must be a short slug", "invalid");
  }
  const avatar = parseAvatar(record["avatar"]);
  if (avatar === undefined) return fail(400, "avatar is too large", "invalid");
  const count = await queryOne<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM vm_users WHERE owner_user_id = $1 AND account_type = 'agent'`,
    [ownerUserId],
  );
  if ((count?.n ?? 0) >= MAX_AGENTS_PER_OWNER) {
    return fail(403, `An owner can have up to ${MAX_AGENTS_PER_OWNER} sub-profiles`, "limit");
  }
  try {
    const inserted = await queryOne<{ id: string }>(
      `INSERT INTO vm_users (
         display_name, username, avatar, account_type, token_claimed,
         owner_user_id, profile_mode, agent_provider, agent_status, phone, push_token
       ) VALUES ($1, $2, $3, 'agent', true, $4, $5, $6, 'active', NULL, NULL)
       RETURNING id`,
      [displayName, username, avatar, ownerUserId, profileMode, provider],
    );
    if (!inserted) return fail(500, "Could not create sub-profile", "error");
    const actor = await loadActor(inserted.id);
    const pub = actor ? toPublicSubProfile(actor, owner.displayName) : null;
    if (!pub) return fail(500, "Could not create sub-profile", "error");
    await audit(pub.id, "subprofile.create", null, { profileMode });
    return { ok: true, subProfile: pub };
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message.includes("unique")) return fail(409, "Username already taken", "conflict");
    return fail(500, "Could not create sub-profile", "error");
  }
}

async function ownedProfile(ownerUserId: string, profileId: string): Promise<
  { ok: true; actor: Actor; ownerName: string } | Gate
> {
  const owner = await loadActor(ownerUserId);
  if (!owner) return fail(401, "Invalid or missing auth token", "auth");
  const gate = ownerMayCreateSubProfile(owner);
  if (!gate.ok) return gate;
  const actor = await loadActor(profileId);
  if (!actor || actor.accountType !== "agent" || actor.ownerUserId !== ownerUserId) {
    return fail(404, "Sub-profile not found", "not_found");
  }
  return { ok: true, actor, ownerName: owner.displayName };
}

export async function updateSubProfile(ownerUserId: string, profileId: string, body: unknown): Promise<
  { ok: true; subProfile: PublicSubProfile } | Gate
> {
  const owned = await ownedProfile(ownerUserId, profileId);
  if (!owned.ok) return owned;
  const record = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const displayName = record["displayName"] == null ? undefined : parseDisplayName(record["displayName"]);
  if (record["displayName"] != null && !displayName) return fail(400, "displayName is invalid", "invalid");
  const username = record["username"] === undefined ? undefined : parseUsername(record["username"]);
  if (record["username"] !== undefined && username === undefined) {
    return fail(400, "username must be 3-32 letters, numbers, or underscores", "invalid");
  }
  const avatar = record["avatar"] === undefined ? undefined : parseAvatar(record["avatar"]);
  if (record["avatar"] !== undefined && avatar === undefined) return fail(400, "avatar is too large", "invalid");
  let status = owned.actor.agentStatus;
  if (record["status"] != null) {
    if (record["status"] !== "active" && record["status"] !== "paused" && record["status"] !== "revoked") {
      return fail(400, "status must be active, paused, or revoked", "invalid");
    }
    status = record["status"];
  }
  let provider = owned.actor.agentProvider;
  if (record["provider"] !== undefined) {
    const parsed = parseProvider(record["provider"], owned.actor.profileMode ?? "persona");
    if (parsed === undefined) return fail(400, "provider is invalid for this profile", "invalid");
    provider = parsed;
  }
  if (status === "revoked") {
    await query(
      `UPDATE vm_agent_credentials SET revoked_at = $2
        WHERE agent_user_id = $1 AND revoked_at IS NULL`,
      [profileId, Date.now()],
    );
  }
  try {
    await query(
      `UPDATE vm_users SET
         display_name = COALESCE($2, display_name),
         username = CASE WHEN $3::boolean THEN $4 ELSE username END,
         avatar = CASE WHEN $5::boolean THEN $6 ELSE avatar END,
         agent_status = $7,
         agent_provider = $8
       WHERE id = $1`,
      [
        profileId,
        displayName ?? null,
        username !== undefined,
        username ?? null,
        avatar !== undefined,
        avatar ?? null,
        status,
        provider,
      ],
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message.includes("unique")) return fail(409, "Username already taken", "conflict");
    return fail(500, "Could not update sub-profile", "error");
  }
  const actor = await loadActor(profileId);
  const pub = actor ? toPublicSubProfile(actor, owned.ownerName) : null;
  if (!pub) return fail(500, "Could not update sub-profile", "error");
  await audit(profileId, "subprofile.update", null, { status });
  return { ok: true, subProfile: pub };
}

export async function deleteSubProfile(ownerUserId: string, profileId: string): Promise<Gate | { ok: true }> {
  const owned = await ownedProfile(ownerUserId, profileId);
  if (!owned.ok) return owned;
  await query(`DELETE FROM vm_users WHERE id = $1 AND owner_user_id = $2`, [profileId, ownerUserId]);
  return { ok: true };
}

export async function upgradeSubProfile(ownerUserId: string, profileId: string, body: unknown): Promise<
  { ok: true; subProfile: PublicSubProfile } | Gate
> {
  const owned = await ownedProfile(ownerUserId, profileId);
  if (!owned.ok) return owned;
  if (owned.actor.profileMode === "agent") {
    const pub = toPublicSubProfile(owned.actor, owned.ownerName);
    if (!pub) return fail(500, "Could not upgrade sub-profile", "error");
    return { ok: true, subProfile: pub };
  }
  const record = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const provider = parseProvider(record["provider"], "agent");
  if (provider === undefined) return fail(400, "provider must be a short slug", "invalid");
  await query(
    `UPDATE vm_users SET profile_mode = 'agent', agent_provider = COALESCE($2, agent_provider) WHERE id = $1`,
    [profileId, provider],
  );
  const actor = await loadActor(profileId);
  const pub = actor ? toPublicSubProfile(actor, owned.ownerName) : null;
  if (!pub) return fail(500, "Could not upgrade sub-profile", "error");
  await audit(profileId, "subprofile.upgrade", null, { provider });
  return { ok: true, subProfile: pub };
}

export async function mintApiKey(ownerUserId: string, profileId: string, body: unknown): Promise<
  { ok: true; key: string; credential: { id: string; prefix: string; scopes: AgentScope[]; createdAt: number } } | Gate
> {
  const owned = await ownedProfile(ownerUserId, profileId);
  if (!owned.ok) return owned;
  if (owned.actor.profileMode !== "agent") {
    return fail(403, "Persona profiles cannot hold API keys. Upgrade to an agent first.", "persona");
  }
  if (owned.actor.agentStatus === "revoked") return fail(403, "This profile is revoked", "revoked");
  const record = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const parsed = parseScopes(record["scopes"], DEFAULT_AGENT_KEY_SCOPES);
  if (!parsed) return fail(400, "scopes must be a list of known agent scopes", "invalid");
  const minted = generateApiKey();
  const now = Date.now();
  const row = await queryOne<{ id: string }>(
    `INSERT INTO vm_agent_credentials (agent_user_id, kind, hash, key_prefix, scopes, created_at)
     VALUES ($1, 'api_key', $2, $3, $4::text[], $5)
     RETURNING id`,
    [profileId, minted.hash, minted.prefix, parsed, now],
  );
  if (!row) return fail(500, "Could not mint a key", "error");
  await audit(profileId, "key.mint", null, { keyId: row.id, scopes: parsed });
  return {
    ok: true,
    key: minted.apiKey,
    credential: { id: row.id, prefix: minted.prefix, scopes: parsed, createdAt: now },
  };
}

export async function listApiKeys(ownerUserId: string, profileId: string): Promise<
  { ok: true; keys: Array<{ id: string; prefix: string | null; scopes: string[]; createdAt: number; lastUsedAt: number | null; revokedAt: number | null }> } | Gate
> {
  const owned = await ownedProfile(ownerUserId, profileId);
  if (!owned.ok) return owned;
  const rows = await query<{
    id: string; key_prefix: string | null; scopes: string[]; created_at: string | number;
    last_used_at: string | number | null; revoked_at: string | number | null;
  }>(
    `SELECT id, key_prefix, scopes, created_at, last_used_at, revoked_at
       FROM vm_agent_credentials
      WHERE agent_user_id = $1 AND kind = 'api_key'
      ORDER BY created_at DESC`,
    [profileId],
  );
  return {
    ok: true,
    keys: rows.map((row) => ({
      id: row.id,
      prefix: row.key_prefix,
      scopes: row.scopes ?? [],
      createdAt: Number(row.created_at) || 0,
      lastUsedAt: row.last_used_at == null ? null : Number(row.last_used_at),
      revokedAt: row.revoked_at == null ? null : Number(row.revoked_at),
    })),
  };
}

export async function revokeApiKey(ownerUserId: string, profileId: string, keyId: string): Promise<Gate | { ok: true }> {
  const owned = await ownedProfile(ownerUserId, profileId);
  if (!owned.ok) return owned;
  if (!parseUuid(keyId)) return fail(400, "Invalid key id", "invalid");
  const row = await queryOne<{ id: string }>(
    `UPDATE vm_agent_credentials SET revoked_at = $3
      WHERE id = $1 AND agent_user_id = $2 AND kind = 'api_key' AND revoked_at IS NULL
      RETURNING id`,
    [keyId, profileId, Date.now()],
  );
  if (!row) return fail(404, "Key not found", "not_found");
  await audit(profileId, "key.revoke", null, { keyId });
  return { ok: true };
}

export async function setWebhook(ownerUserId: string, profileId: string, body: unknown): Promise<
  { ok: true; webhook: { url: string; secret: string } } | Gate
> {
  const owned = await ownedProfile(ownerUserId, profileId);
  if (!owned.ok) return owned;
  if (owned.actor.profileMode !== "agent") {
    return fail(403, "Persona profiles cannot register a webhook", "persona");
  }
  const record = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const url = parseWebhookUrl(record["url"]);
  if (!url) return fail(400, "url must be https (localhost http is allowed)", "invalid");
  const minted = generateWebhookSecret();
  const now = Date.now();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE vm_agent_credentials SET revoked_at = $2
        WHERE agent_user_id = $1 AND kind = 'webhook' AND revoked_at IS NULL`,
      [profileId, now],
    );
    await client.query(
      `INSERT INTO vm_agent_credentials (agent_user_id, kind, webhook_url, secret_sealed, scopes, created_at)
       VALUES ($1, 'webhook', $2, $3, ARRAY[]::text[], $4)`,
      [profileId, url, minted.sealed, now],
    );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
  await audit(profileId, "webhook.set", null, { url });
  return { ok: true, webhook: { url, secret: minted.secret } };
}

export async function clearWebhook(ownerUserId: string, profileId: string): Promise<Gate | { ok: true }> {
  const owned = await ownedProfile(ownerUserId, profileId);
  if (!owned.ok) return owned;
  await query(
    `UPDATE vm_agent_credentials SET revoked_at = $2
      WHERE agent_user_id = $1 AND kind = 'webhook' AND revoked_at IS NULL`,
    [profileId, Date.now()],
  );
  await audit(profileId, "webhook.clear");
  return { ok: true };
}

export async function loadChatGate(chatId: string): Promise<ChatGate | null> {
  const row = await queryOne<ChatGateRow>(
    `SELECT c.id, c.type, c.created_by, c.is_e2e,
            EXISTS (
              SELECT 1 FROM vm_messages m
               WHERE m.chat_id = c.id
                 AND (m.is_encrypted = true OR m.text LIKE 'U2FsdGVkX1%')
            ) AS has_e2e_message,
            EXISTS (
              SELECT 1 FROM vm_chat_members cm
              JOIN vm_users u ON u.id = cm.user_id
               WHERE cm.chat_id = c.id
                 AND (
                   u.account_type = 'child'
                   OR EXISTS (SELECT 1 FROM vm_parent_child pc WHERE pc.child_id = u.id)
                 )
            ) AS has_child
       FROM vm_chats c
      WHERE c.id = $1`,
    [chatId],
  );
  if (!row) return null;
  return {
    id: row.id,
    type: row.type,
    createdBy: row.created_by,
    isE2e: row.is_e2e === true,
    hasE2eMessage: row.has_e2e_message === true,
    hasChild: row.has_child === true,
  };
}

async function isMember(chatId: string, userId: string): Promise<boolean> {
  const row = await queryOne<{ user_id: string }>(
    `SELECT user_id FROM vm_chat_members WHERE chat_id = $1 AND user_id = $2`,
    [chatId, userId],
  );
  return !!row;
}

export async function addAgentToChat(callerId: string, profileId: string, chatId: string): Promise<
  { ok: true; chatId: string; agentUserId: string; assistantLabel: string; alreadyMember: boolean } | Gate
> {
  if (!parseUuid(profileId) || !parseUuid(chatId)) return fail(400, "Invalid id", "invalid");
  const caller = await loadActor(callerId);
  if (!caller) return fail(401, "Invalid or missing auth token", "auth");
  const callerGate = ownerMayCreateSubProfile(caller);
  if (!callerGate.ok) return callerGate;
  const actor = await loadActor(profileId);
  if (!actor || actor.accountType !== "agent" || !actor.ownerUserId || !actor.profileMode) {
    return fail(404, "Sub-profile not found", "not_found");
  }
  if (actor.profileMode !== "agent") {
    return fail(409, "Upgrade this persona to an agent before adding it to chats", "persona");
  }
  if (actor.agentStatus !== "active") return fail(403, "This profile is not active", "paused");
  const chat = await loadChatGate(chatId);
  if (!chat) return fail(404, "Chat not found", "not_found");
  const owns = actor.ownerUserId === callerId;
  const admin = chat.createdBy === callerId;
  if (!owns && !admin) return fail(403, "Only the profile owner or the chat admin can add this agent", "forbidden");
  if (!owns) {
    const ownerInChat = await isMember(chatId, actor.ownerUserId);
    if (!ownerInChat) {
      return fail(403, "The chat admin can add an agent only when its owner is already in the chat", "forbidden");
    }
  } else if (!(await isMember(chatId, callerId)) && chat.createdBy !== callerId) {
    return fail(403, "Join the chat before adding your agent", "forbidden");
  }
  const blocked = chatAllowsAgent(chat);
  if (!blocked.ok) return blocked;
  const existing = await isMember(chatId, profileId);
  if (!existing) {
    await query(`INSERT INTO vm_chat_members (chat_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [chatId, profileId]);
  }
  const label = assistantLabel(await ownerName(actor.ownerUserId));
  await audit(profileId, "chat.add", chatId, { callerId });
  return { ok: true, chatId, agentUserId: profileId, assistantLabel: label, alreadyMember: existing };
}

export async function removeAgentFromChat(callerId: string, profileId: string, chatId: string): Promise<
  { ok: true; removed: boolean } | Gate
> {
  if (!parseUuid(profileId) || !parseUuid(chatId)) return fail(400, "Invalid id", "invalid");
  const caller = await loadActor(callerId);
  if (!caller) return fail(401, "Invalid or missing auth token", "auth");
  if (caller.accountType === "agent" || caller.accountType === "child" || caller.supervised) {
    return fail(403, "Not allowed to remove this agent", "forbidden");
  }
  const actor = await loadActor(profileId);
  if (!actor || actor.accountType !== "agent") return fail(404, "Sub-profile not found", "not_found");
  const chat = await loadChatGate(chatId);
  if (!chat) return fail(404, "Chat not found", "not_found");
  const owns = actor.ownerUserId === callerId;
  const admin = chat.createdBy === callerId;
  if (!owns && !admin) return fail(403, "Only the profile owner or the chat admin can remove this agent", "forbidden");
  const removed = await query<{ user_id: string }>(
    `DELETE FROM vm_chat_members WHERE chat_id = $1 AND user_id = $2 RETURNING user_id`,
    [chatId, profileId],
  );
  await audit(profileId, "chat.remove", chatId, { callerId });
  return { ok: true, removed: removed.length > 0 };
}

type RateRow = { minute_count: number; day_count: number; media_count: number };

async function enforceRateLimit(agentUserId: string, isMedia: boolean, now: number): Promise<Gate | { ok: true }> {
  const row = await queryOne<RateRow>(
    `SELECT
       COUNT(*) FILTER (WHERE created_at >= $2)::int AS minute_count,
       COUNT(*) FILTER (WHERE created_at >= $3)::int AS day_count,
       COUNT(*) FILTER (WHERE created_at >= $3 AND type <> 'text')::int AS media_count
     FROM vm_messages
     WHERE sender_id = $1 AND created_at >= $3`,
    [agentUserId, now - 60_000, utcDayStart(now)],
  );
  return rateLimitDecision({
    sentLastMinute: row?.minute_count ?? 0,
    sentToday: row?.day_count ?? 0,
    mediaToday: row?.media_count ?? 0,
    isMedia,
    now,
  });
}

type MessageRow = {
  id: string;
  chat_id: string;
  text: string;
  type: string;
  media: unknown;
  created_at: string | number;
};

async function existingClientMessage(senderId: string, clientId: string): Promise<MessageRow | null> {
  return queryOne<MessageRow>(
    `SELECT id, chat_id, text, type, media, created_at
       FROM vm_messages WHERE sender_id = $1 AND client_id = $2`,
    [senderId, clientId],
  );
}

export async function noteHumanCiphertext(chatId: string, text: string): Promise<void> {
  if (!looksLikeDeviceCiphertext(text)) return;
  try {
    await query(`UPDATE vm_chats SET is_e2e = true WHERE id = $1 AND is_e2e = false`, [chatId]);
  } catch {
    /* the next agent join still sees the ciphertext row */
  }
}

export async function notifyChatAgents(chatId: string, message: SerializedMessage, senderId: string): Promise<void> {
  try {
    const hooks = await query<{ id: string; webhook_url: string; secret_sealed: string }>(
      `SELECT u.id, c.webhook_url, c.secret_sealed
         FROM vm_chat_members cm
         JOIN vm_users u ON u.id = cm.user_id
         JOIN vm_agent_credentials c ON c.agent_user_id = u.id
          AND c.kind = 'webhook' AND c.revoked_at IS NULL
        WHERE cm.chat_id = $1
          AND u.account_type = 'agent'
          AND u.profile_mode = 'agent'
          AND u.agent_status = 'active'
          AND u.id <> $2
          AND c.webhook_url IS NOT NULL
          AND c.secret_sealed IS NOT NULL`,
      [chatId, senderId],
    );
    await Promise.all(hooks.map(async (hook) => {
      const secret = openSecret(hook.secret_sealed);
      if (!secret || !hook.webhook_url) return;
      const body = JSON.stringify({
        type: "message.created",
        agentUserId: hook.id,
        chatId,
        message,
      });
      try {
        const response = await fetch(hook.webhook_url, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-zivr-signature": signWebhookBody(secret, body),
          },
          body,
          signal: AbortSignal.timeout(3000),
        });
        if (!response.ok) {
          await audit(hook.id, "webhook.delivery_failed", chatId, { status: response.status });
        }
      } catch {
        await audit(hook.id, "webhook.delivery_failed", chatId, { status: 0 });
      }
    }));
  } catch {
    /* webhook delivery is best-effort */
  }
}

async function fanoutSaved(
  row: MessageRow,
  senderId: string,
  senderName: string,
  clientId: string,
  duplicate: boolean,
): Promise<SerializedMessage> {
  const outgoing = serializedMessageFromRow(row, { senderId, senderName, localId: clientId });
  if (duplicate) return outgoing;
  try {
    await query(`UPDATE vm_chats SET last_message_at = $1 WHERE id = $2`, [Number(row.created_at) || Date.now(), row.chat_id]);
  } catch { /* history remains authoritative */ }
  await fanoutMessage(outgoing);
  if (outgoing.type === "text") {
    void import("./socket").then((mod) => mod.checkContentForChild(outgoing.id, row.chat_id, senderId, outgoing.text)).catch(() => {});
  }
  try {
    const tokens = await pushTokensForChat(row.chat_id, senderId);
    if (tokens.length > 0) {
      await sendExpoPush(tokens, senderName, messagePreview(outgoing.text, outgoing.type), "default");
    }
  } catch { /* push is best-effort */ }
  void notifyChatAgents(row.chat_id, outgoing, senderId);
  return outgoing;
}

function unwrapMedia(media: unknown): { ok: true; media: unknown } | Gate {
  if (!Array.isArray(media)) return { ok: true, media };
  if (media.length > 1) return fail(400, "One attachment per message", "invalid");
  return { ok: true, media: media[0] ?? null };
}

export async function deliverSubProfileMessage(input: {
  profileId: string;
  actorUserId: string;
  chatId: string;
  clientId: unknown;
  text: unknown;
  type?: unknown;
  media?: unknown;
  mode: "owner_send_as" | "agent_api";
}): Promise<{ ok: true; message: SerializedMessage; duplicate: boolean } | Gate> {
  const clientId = parseClientId(input.clientId);
  if (!clientId) return fail(400, "A client operation id is required", "invalid");
  if (!parseUuid(input.chatId)) return fail(400, "Invalid chat id", "invalid");
  const actor = await loadActor(input.profileId);
  if (!actor || actor.accountType !== "agent" || !actor.ownerUserId || !actor.profileMode || !actor.agentStatus) {
    return fail(404, "Sub-profile not found", "not_found");
  }
  if (input.mode === "owner_send_as" && input.actorUserId !== actor.ownerUserId) {
    return fail(403, "Only the owner can send as this profile", "forbidden");
  }
  if (input.mode === "agent_api" && input.actorUserId !== actor.id) {
    return fail(403, "Token does not match this profile", "forbidden");
  }
  if (actor.agentStatus !== "active") return fail(403, "This profile is paused", "paused");
  if (input.mode === "agent_api" && actor.profileMode !== "agent") {
    return fail(403, "Persona profiles have no inbound API", "persona");
  }
  if (looksLikeDeviceCiphertext(typeof input.text === "string" ? input.text : "")) {
    return fail(403, "Agents cannot send in end-to-end encrypted chats", "e2e");
  }
  const chat = await loadChatGate(input.chatId);
  if (!chat) return fail(404, "Chat not found", "not_found");
  const blocked = chatAllowsAgent(chat);
  if (!blocked.ok) return blocked;
  if (actor.profileMode === "persona") {
    if (!(await isMember(input.chatId, actor.ownerUserId))) {
      return fail(403, "Persona profiles can post only in chats the owner belongs to", "not_member");
    }
  } else if (!(await isMember(input.chatId, actor.id))) {
    return fail(403, "Agents cannot start a chat. Wait for an invite or an incoming message.", "not_member");
  }
  const prior = await existingClientMessage(actor.id, clientId);
  if (prior) {
    if (prior.chat_id !== input.chatId) return fail(409, "Client operation id belongs to another chat", "invalid");
    const message = await fanoutSaved(prior, actor.id, actor.displayName, clientId, true);
    return { ok: true, message, duplicate: true };
  }
  const unwrapped = unwrapMedia(input.media);
  if (!unwrapped.ok) return unwrapped;
  const prepared = prepareAgentOutgoingMessage({ text: input.text, type: input.type, media: unwrapped.media });
  if (!prepared.ok) return fail(400, prepared.error, "invalid");
  const limited = await enforceRateLimit(actor.id, prepared.message.media != null, Date.now());
  if (!limited.ok) return limited;
  const now = Date.now();
  const inserted = await queryOne<MessageRow>(
    `INSERT INTO vm_messages (chat_id, sender_id, client_id, text, type, media, created_at)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
     ON CONFLICT (sender_id, client_id) WHERE client_id IS NOT NULL DO NOTHING
     RETURNING id, chat_id, text, type, media, created_at`,
    [
      input.chatId,
      actor.id,
      clientId,
      prepared.message.text,
      prepared.message.type,
      mediaJsonParam(prepared.message.media),
      now,
    ],
  );
  const row = inserted ?? await existingClientMessage(actor.id, clientId);
  if (!row) return fail(500, "Message could not be persisted", "error");
  if (row.chat_id !== input.chatId) return fail(409, "Client operation id belongs to another chat", "invalid");
  const duplicate = !inserted;
  const message = await fanoutSaved(row, actor.id, actor.displayName, clientId, duplicate);
  if (!duplicate) await audit(actor.id, "message.send", input.chatId, { messageId: row.id, type: row.type });
  return { ok: true, message, duplicate };
}

export async function exchangeAgentToken(apiKey: string): Promise<
  { ok: true; accessToken: string; tokenType: "Bearer"; expiresIn: number; agentUserId: string; ownerUserId: string; scopes: string[] } | Gate
> {
  if (!looksLikeApiKey(apiKey)) return fail(401, "API key is invalid", "auth");
  const row = await queryOne<{
    id: string;
    scopes: string[] | null;
    revoked_at: string | number | null;
    agent_id: string;
    owner_user_id: string | null;
    profile_mode: string | null;
    agent_status: string | null;
    account_type: string | null;
  }>(
    `SELECT c.id, c.scopes, c.revoked_at, u.id AS agent_id, u.owner_user_id, u.profile_mode, u.agent_status, u.account_type
       FROM vm_agent_credentials c
       JOIN vm_users u ON u.id = c.agent_user_id
      WHERE c.kind = 'api_key' AND c.hash = $1`,
    [hashApiKey(apiKey)],
  );
  if (!row || row.revoked_at != null || row.account_type !== "agent" || row.profile_mode !== "agent" || !row.owner_user_id) {
    return fail(401, "API key is invalid", "auth");
  }
  if (row.agent_status !== "active") return fail(403, "This profile is paused", "paused");
  const scopes = (row.scopes ?? []).filter((scope): scope is AgentScope =>
    scope === "messages:send" || scope === "messages:read" || scope === "media:send"
    || scope === "chats:list" || scope === "calendar:read" || scope === "calendar:propose");
  await query(`UPDATE vm_agent_credentials SET last_used_at = $2 WHERE id = $1`, [row.id, Date.now()]);
  const accessToken = signAgentToken({ sub: row.agent_id, owner: row.owner_user_id, scopes, keyId: row.id });
  await audit(row.agent_id, "token.exchange", null, { keyId: row.id });
  return {
    ok: true,
    accessToken,
    tokenType: "Bearer",
    expiresIn: 60 * 60,
    agentUserId: row.agent_id,
    ownerUserId: row.owner_user_id,
    scopes,
  };
}

export async function requireAgent(authorization: string | undefined, scope: AgentScope): Promise<
  { ok: true; claims: AgentTokenClaims; actor: Actor } | Gate
> {
  const match = /^Bearer\s+(\S+)$/i.exec(authorization?.trim() ?? "");
  const claims = verifyAgentToken(match?.[1]);
  if (!claims) return fail(401, "Agent token is invalid or expired", "auth");
  if (!hasScope(claims.scopes, scope)) return fail(403, `Missing scope ${scope}`, "scope");
  const key = await queryOne<{ revoked_at: string | number | null }>(
    `SELECT revoked_at FROM vm_agent_credentials
      WHERE id = $1 AND agent_user_id = $2 AND kind = 'api_key'`,
    [claims.keyId, claims.sub],
  );
  if (!key || key.revoked_at != null) return fail(401, "Agent token was revoked", "auth");
  const actor = await loadActor(claims.sub);
  if (!actor || actor.ownerUserId !== claims.owner || actor.accountType !== "agent" || actor.profileMode !== "agent") {
    return fail(401, "Agent token is invalid", "auth");
  }
  if (actor.agentStatus !== "active") return fail(403, "This profile is paused", "paused");
  return { ok: true, claims, actor };
}

export async function listAgentChats(agentUserId: string): Promise<Array<Record<string, unknown>>> {
  return query(
    `SELECT c.id, c.type, c.name, c.is_e2e AS "isE2e", cm.joined_at AS "joinedAt",
            o.display_name AS "ownerDisplayName",
            (SELECT m.text FROM vm_messages m WHERE m.chat_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS "lastMessage"
       FROM vm_chats c
       JOIN vm_chat_members cm ON cm.chat_id = c.id AND cm.user_id = $1
       JOIN vm_users agent ON agent.id = $1
       JOIN vm_users o ON o.id = agent.owner_user_id
      ORDER BY COALESCE(c.last_message_at, c.created_at) DESC`,
    [agentUserId],
  );
}

export async function listAgentEvents(agentUserId: string, since: number): Promise<SerializedMessage[]> {
  const rows = await query<{
    id: string; chatId: string; senderId: string; text: string; type: string;
    createdAt: string | number; senderName: string | null; media: unknown; localId: string | null;
  }>(
    `SELECT m.id, m.chat_id AS "chatId", m.sender_id AS "senderId", m.text, m.type, m.media,
            m.created_at AS "createdAt", m.client_id AS "localId", u.display_name AS "senderName"
       FROM vm_messages m
       JOIN vm_chat_members cm ON cm.chat_id = m.chat_id AND cm.user_id = $1
       LEFT JOIN vm_users u ON u.id = m.sender_id
      WHERE m.created_at > $2 AND m.created_at >= cm.joined_at
      ORDER BY m.created_at ASC
      LIMIT 100`,
    [agentUserId, since],
  );
  return rows.map((row) => serializedMessageFromRow(
    { id: row.id, chat_id: row.chatId, text: row.text, type: row.type, media: row.media, created_at: row.createdAt },
    { senderId: row.senderId, senderName: row.senderName ?? "Unknown", localId: row.localId },
  ));
}

export type PublicProposal = {
  id: string;
  agentUserId: string;
  ownerUserId: string;
  chatId: string;
  messageId: string | null;
  title: string;
  startsAt: number;
  endsAt: number;
  note: string | null;
  status: ProposalStatus;
  approval: "owner_or_admin";
  decidedBy: string | null;
  decidedAt: number | null;
  calendarWrite: string;
  createdAt: number;
};

type ProposalRow = {
  id: string;
  agent_user_id: string;
  owner_user_id: string;
  chat_id: string;
  message_id: string | null;
  title: string;
  starts_at: string | number;
  ends_at: string | number;
  note: string | null;
  status: ProposalStatus;
  decided_by: string | null;
  decided_at: string | number | null;
  calendar_write: string;
  created_at: string | number;
};

function toPublicProposal(row: ProposalRow): PublicProposal {
  return {
    id: row.id,
    agentUserId: row.agent_user_id,
    ownerUserId: row.owner_user_id,
    chatId: row.chat_id,
    messageId: row.message_id,
    title: row.title,
    startsAt: Number(row.starts_at),
    endsAt: Number(row.ends_at),
    note: row.note,
    status: row.status,
    approval: "owner_or_admin",
    decidedBy: row.decided_by,
    decidedAt: row.decided_at == null ? null : Number(row.decided_at),
    calendarWrite: row.calendar_write,
    createdAt: Number(row.created_at) || 0,
  };
}

export async function createCalendarProposal(input: {
  agentUserId: string;
  chatId: unknown;
  title: unknown;
  startsAt: unknown;
  endsAt: unknown;
  note: unknown;
  clientId: unknown;
}): Promise<{ ok: true; proposal: PublicProposal; message: SerializedMessage; duplicate: boolean } | Gate> {
  if (!calendarProposeEnabled()) {
    return fail(403, "Calendar propose is disabled", "feature_disabled");
  }
  const chatId = parseUuid(input.chatId);
  if (!chatId) return fail(400, "chatId is required", "invalid");
  const clientId = parseClientId(input.clientId);
  if (!clientId) return fail(400, "A client operation id is required", "invalid");
  const title = parseProposalTitle(input.title);
  if (!title) return fail(400, "title is required", "invalid");
  const slot = validateProposalSlot(input.startsAt, input.endsAt);
  if (!slot.ok) return fail(400, slot.error, "invalid");
  const note = parseProposalNote(input.note);
  if (note === undefined) return fail(400, "note is too long", "invalid");
  const actor = await loadActor(input.agentUserId);
  if (!actor || !actor.ownerUserId || actor.profileMode !== "agent" || actor.agentStatus !== "active") {
    return fail(403, "This profile cannot propose calendar slots", "forbidden");
  }
  const prior = await queryOne<ProposalRow>(
    `SELECT * FROM vm_calendar_proposals WHERE agent_user_id = $1 AND client_id = $2`,
    [actor.id, clientId],
  );
  if (prior) {
    const messageRow = prior.message_id
      ? await queryOne<MessageRow>(
        `SELECT id, chat_id, text, type, media, created_at FROM vm_messages WHERE id = $1`,
        [prior.message_id],
      )
      : null;
    if (!messageRow) return fail(409, "Proposal already exists", "conflict");
    return {
      ok: true,
      proposal: toPublicProposal(prior),
      message: serializedMessageFromRow(messageRow, { senderId: actor.id, senderName: actor.displayName, localId: clientId }),
      duplicate: true,
    };
  }
  const chat = await loadChatGate(chatId);
  if (!chat) return fail(404, "Chat not found", "not_found");
  const blocked = chatAllowsAgent(chat);
  if (!blocked.ok) return blocked;
  if (!(await isMember(chatId, actor.id))) {
    return fail(403, "Agents cannot start a chat. Add this profile to the chat first.", "not_member");
  }
  const limited = await enforceRateLimit(actor.id, false, Date.now());
  if (!limited.ok) return limited;
  const now = Date.now();
  const summary = proposalSummary(title, slot.startsAt, slot.endsAt);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const inserted = await client.query<ProposalRow>(
      `INSERT INTO vm_calendar_proposals (
         agent_user_id, owner_user_id, chat_id, client_id, title, starts_at, ends_at, note, status, calendar_write, created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', 'not_attempted', $9)
       ON CONFLICT (agent_user_id, client_id) WHERE client_id IS NOT NULL DO NOTHING
       RETURNING *`,
      [actor.id, actor.ownerUserId, chatId, clientId, title, slot.startsAt, slot.endsAt, note, now],
    );
    const proposal = inserted.rows[0];
    if (!proposal) {
      await client.query("ROLLBACK");
      const again = await queryOne<ProposalRow>(
        `SELECT * FROM vm_calendar_proposals WHERE agent_user_id = $1 AND client_id = $2`,
        [actor.id, clientId],
      );
      if (!again) return fail(409, "Proposal already exists", "conflict");
      const messageRow = again.message_id
        ? await queryOne<MessageRow>(
          `SELECT id, chat_id, text, type, media, created_at FROM vm_messages WHERE id = $1`,
          [again.message_id],
        )
        : null;
      if (!messageRow) return fail(409, "Proposal already exists", "conflict");
      return {
        ok: true,
        proposal: toPublicProposal(again),
        message: serializedMessageFromRow(messageRow, { senderId: actor.id, senderName: actor.displayName, localId: clientId }),
        duplicate: true,
      };
    }
    const card = calendarProposalCard({
      proposalId: proposal.id,
      title,
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
      status: "pending",
      note,
    });
    const message = await client.query<MessageRow>(
      `INSERT INTO vm_messages (chat_id, sender_id, client_id, text, type, media, created_at)
       VALUES ($1, $2, $3, $4, 'calendar_proposal', $5::jsonb, $6)
       RETURNING id, chat_id, text, type, media, created_at`,
      [chatId, actor.id, clientId, summary, JSON.stringify(card), now],
    );
    const messageRow = message.rows[0];
    if (!messageRow) {
      await client.query("ROLLBACK");
      return fail(500, "Could not post the proposal card", "error");
    }
    await client.query(`UPDATE vm_calendar_proposals SET message_id = $2 WHERE id = $1`, [proposal.id, messageRow.id]);
    await client.query("COMMIT");
    proposal.message_id = messageRow.id;
    const outgoing = await fanoutSaved(messageRow, actor.id, actor.displayName, clientId, false);
    await audit(actor.id, "calendar.propose", chatId, { proposalId: proposal.id });
    return { ok: true, proposal: toPublicProposal(proposal), message: outgoing, duplicate: false };
  } catch (err) {
    try { await client.query("ROLLBACK"); } catch { /* already closed */ }
    const message = err instanceof Error ? err.message : "";
    if (message.toLowerCase().includes("unique") || message.toLowerCase().includes("duplicate")) {
      return fail(409, "Client operation id was already used", "conflict");
    }
    throw err;
  } finally {
    client.release();
  }
}

export async function getProposalForAgent(agentUserId: string, proposalId: string): Promise<PublicProposal | null> {
  const row = await queryOne<ProposalRow>(
    `SELECT * FROM vm_calendar_proposals WHERE id = $1 AND agent_user_id = $2`,
    [proposalId, agentUserId],
  );
  return row ? toPublicProposal(row) : null;
}

export async function respondToCalendarProposal(input: {
  callerId: string;
  proposalId: string;
  decision: unknown;
}): Promise<
  { ok: true; proposal: PublicProposal; role: "owner" | "admin"; calendarWrite: string; todo?: string; idempotent: boolean } | Gate
> {
  if (!parseUuid(input.proposalId)) return fail(400, "Invalid proposal id", "invalid");
  if (input.decision !== "yes" && input.decision !== "no") return fail(400, "decision must be yes or no", "invalid");
  const caller = await loadActor(input.callerId);
  if (!caller) return fail(401, "Invalid or missing auth token", "auth");
  const proposal = await queryOne<ProposalRow>(`SELECT * FROM vm_calendar_proposals WHERE id = $1`, [input.proposalId]);
  if (!proposal) return fail(404, "Proposal not found", "not_found");
  const chat = await loadChatGate(proposal.chat_id);
  if (!chat) return fail(404, "Chat not found", "not_found");
  const allowed = canDecideProposal({
    callerId: caller.id,
    callerAccountType: caller.accountType,
    callerSupervised: caller.supervised,
    ownerUserId: proposal.owner_user_id,
    chatCreatedBy: chat.createdBy,
  });
  if (!allowed.ok) return allowed;
  const next = nextProposalStatus(proposal.status, input.decision);
  if (!next.ok) return next;
  if (next.idempotent) {
    return {
      ok: true,
      proposal: toPublicProposal(proposal),
      role: allowed.role,
      calendarWrite: proposal.calendar_write,
      idempotent: true,
    };
  }
  let calendarWrite = "dismissed";
  let todo: string | undefined;
  if (input.decision === "yes") {
    const written = await writeMainProfileCalendarEvent({
      ownerUserId: proposal.owner_user_id,
      title: proposal.title,
      startsAt: Number(proposal.starts_at),
      endsAt: Number(proposal.ends_at),
      note: proposal.note,
    });
    calendarWrite = written.calendarWrite;
    if (written.calendarWrite === "pending_oauth") todo = written.todo;
  }
  const now = Date.now();
  const updated = await queryOne<ProposalRow>(
    `UPDATE vm_calendar_proposals
        SET status = $2, decided_by = $3, decided_at = $4, calendar_write = $5
      WHERE id = $1 AND status = 'pending'
      RETURNING *`,
    [proposal.id, next.status, caller.id, now, calendarWrite],
  );
  if (!updated) {
    const again = await queryOne<ProposalRow>(`SELECT * FROM vm_calendar_proposals WHERE id = $1`, [proposal.id]);
    if (again && again.status === next.status) {
      return { ok: true, proposal: toPublicProposal(again), role: allowed.role, calendarWrite: again.calendar_write, idempotent: true };
    }
    return fail(409, "This proposal was already decided", "conflict");
  }
  const card = calendarProposalCard({
    proposalId: updated.id,
    title: updated.title,
    startsAt: Number(updated.starts_at),
    endsAt: Number(updated.ends_at),
    status: updated.status,
    note: updated.note,
  });
  if (updated.message_id) {
    await query(
      `UPDATE vm_messages SET media = $2::jsonb WHERE id = $1`,
      [updated.message_id, JSON.stringify(card)],
    );
  }
  const decisionText = proposalDecisionText({
    decision: input.decision,
    title: updated.title,
    actorName: caller.displayName,
    calendarWrite: input.decision === "no" ? "dismissed" : calendarWrite === "written" ? "written" : "pending_oauth",
  });
  const decisionRow = await queryOne<MessageRow>(
    `INSERT INTO vm_messages (chat_id, sender_id, client_id, text, type, created_at)
     VALUES ($1, $2, $3, $4, 'text', $5)
     ON CONFLICT (sender_id, client_id) WHERE client_id IS NOT NULL DO NOTHING
     RETURNING id, chat_id, text, type, media, created_at`,
    [updated.chat_id, caller.id, `proposal-decision:${updated.id}`, decisionText, now],
  );
  if (decisionRow) {
    await fanoutSaved(decisionRow, caller.id, caller.displayName, `proposal-decision:${updated.id}`, false);
  }
  await audit(updated.agent_user_id, input.decision === "yes" ? "calendar.approve" : "calendar.decline", updated.chat_id, {
    proposalId: updated.id,
    role: allowed.role,
    calendarWrite,
  });
  return { ok: true, proposal: toPublicProposal(updated), role: allowed.role, calendarWrite, todo, idempotent: false };
}

export async function assertHumanCanOpenDirect(myUserId: string, theirUserId: string): Promise<Gate | { ok: true }> {
  const [me, them] = await Promise.all([loadActor(myUserId), loadActor(theirUserId)]);
  if (me?.accountType === "agent") return fail(403, "Agents cannot start chats", "agent_cannot_start");
  if (!them || them.accountType !== "agent") return { ok: true };
  if (them.profileMode !== "agent" || them.agentStatus !== "active") {
    return fail(403, "This profile cannot receive direct chats", "agent_unavailable");
  }
  if (me?.accountType === "child" || me?.supervised) {
    return fail(403, "Supervised accounts cannot message agents", "kids");
  }
  return { ok: true };
}

export async function assertGroupHasNoAgents(creatorId: string, memberIds: string[]): Promise<Gate | { ok: true }> {
  const creator = await loadActor(creatorId);
  if (creator?.accountType === "agent") return fail(403, "Agents cannot start chats", "agent_cannot_start");
  if (memberIds.length === 0) return { ok: true };
  const rows = await query<{ id: string }>(
    `SELECT id FROM vm_users WHERE id = ANY($1::uuid[]) AND account_type = 'agent'`,
    [memberIds],
  );
  if (rows.length > 0) {
    return fail(403, "Add an agent with the sub-profile chat endpoint", "agent_membership");
  }
  return { ok: true };
}

export async function rejectAgentMemberSend(userId: string): Promise<Gate | { ok: true }> {
  const actor = await loadActor(userId);
  if (actor?.accountType === "agent") {
    return fail(403, "Agents send through /v1/agent/messages", "agent");
  }
  return { ok: true };
}
