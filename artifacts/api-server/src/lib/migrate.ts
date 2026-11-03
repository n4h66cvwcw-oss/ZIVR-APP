import { query } from "./db";
import { migrateUserEmail } from "./user-email-migrate";

export async function migrate(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS vm_users (
      id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      display_name       TEXT NOT NULL,
      username           TEXT UNIQUE,
      phone              TEXT,
      avatar             TEXT,
      status_message     TEXT DEFAULT 'Hey there! I''m on ZIVR',
      push_token         TEXT,
      preferred_language TEXT DEFAULT 'English',
      is_online          BOOLEAN DEFAULT false,
      last_seen          BIGINT DEFAULT 0,
      created_at         BIGINT DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
    )
  `);

  // Add preferred_language to existing tables that were created without it
  await query(`
    ALTER TABLE vm_users
    ADD COLUMN IF NOT EXISTS preferred_language TEXT DEFAULT 'English'
  `);
  await query(`
    ALTER TABLE vm_users
    ADD COLUMN IF NOT EXISTS recovery_code_hash TEXT
  `);
  await query(`
    ALTER TABLE vm_users
    ADD COLUMN IF NOT EXISTS recovery_code_acknowledged BOOLEAN DEFAULT false
  `);
  await query(`
    ALTER TABLE vm_users
    ADD COLUMN IF NOT EXISTS content_alert_min_severity TEXT NOT NULL DEFAULT 'medium'
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS vm_chats (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      type            TEXT NOT NULL DEFAULT 'direct',
      name            TEXT,
      description     TEXT,
      created_by      UUID REFERENCES vm_users(id) ON DELETE SET NULL,
      last_message_at BIGINT,
      created_at      BIGINT DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS vm_chat_members (
      chat_id   UUID NOT NULL REFERENCES vm_chats(id) ON DELETE CASCADE,
      user_id   UUID NOT NULL REFERENCES vm_users(id) ON DELETE CASCADE,
      joined_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
      PRIMARY KEY (chat_id, user_id)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS vm_messages (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      chat_id      UUID NOT NULL REFERENCES vm_chats(id) ON DELETE CASCADE,
      sender_id    UUID REFERENCES vm_users(id) ON DELETE SET NULL,
      text         TEXT NOT NULL DEFAULT '',
      type         TEXT NOT NULL DEFAULT 'text',
      is_encrypted BOOLEAN DEFAULT false,
      read_at      BIGINT,
      created_at   BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
    )
  `);

  // Idempotency key for live message sends (socket localId / REST clientId).
  // Partial unique index matches ON CONFLICT (sender_id, client_id) WHERE client_id IS NOT NULL.
  await query(`
    ALTER TABLE vm_messages
    ADD COLUMN IF NOT EXISTS client_id TEXT
  `);
  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS vm_messages_sender_client_id_unique
      ON vm_messages (sender_id, client_id)
      WHERE client_id IS NOT NULL
  `);

  // Inline image payload (data URL). Nullable so existing text rows stay valid.
  // See message-content.ts for the size cap. No object storage on Render Starter.
  await query(`
    ALTER TABLE vm_messages
    ADD COLUMN IF NOT EXISTS media JSONB
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS vm_scheduled_messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      sender_id UUID NOT NULL REFERENCES vm_users(id) ON DELETE CASCADE,
      chat_id UUID NOT NULL REFERENCES vm_chats(id) ON DELETE CASCADE,
      text TEXT NOT NULL,
      scheduled_for BIGINT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'sending', 'sent', 'cancelled', 'failed')),
      sent_message_id UUID REFERENCES vm_messages(id) ON DELETE SET NULL,
      failure_reason TEXT,
      created_at BIGINT NOT NULL,
      updated_at BIGINT NOT NULL
    )
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS idx_scheduled_messages_due
      ON vm_scheduled_messages (scheduled_for) WHERE status = 'pending'
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS idx_scheduled_messages_sender
      ON vm_scheduled_messages (sender_id, scheduled_for)
      WHERE status IN ('pending', 'sending')
  `);
  await query(`
    ALTER TABLE vm_scheduled_messages
    ADD COLUMN IF NOT EXISTS approval_reminder_minutes INT
  `);
  await query(`
    ALTER TABLE vm_scheduled_messages
    ADD COLUMN IF NOT EXISTS reminder_sent_at BIGINT
  `);

  // Cloud backup for local chats
  await query(`
    CREATE TABLE IF NOT EXISTS vm_chat_backups (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id      UUID NOT NULL REFERENCES vm_users(id) ON DELETE CASCADE,
      local_chat_id TEXT NOT NULL,
      chat_name    TEXT NOT NULL,
      encrypted_data TEXT NOT NULL,
      message_count INT DEFAULT 0,
      backed_up_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
      UNIQUE (user_id, local_chat_id)
    )
  `);

  // Durable per-account quota for optional AI chat-export appendices.
  await query(`
    CREATE TABLE IF NOT EXISTS vm_ai_export_rate_limits (
      user_id           UUID PRIMARY KEY REFERENCES vm_users(id) ON DELETE CASCADE,
      window_started_at BIGINT NOT NULL,
      request_count     INT NOT NULL DEFAULT 0
    )
  `);

  // Auth token bootstrap flag: tokens are issued once per user (at registration
  // or via a one-time claim for accounts created before tokens existed).
  await query(`
    ALTER TABLE vm_users
    ADD COLUMN IF NOT EXISTS token_claimed BOOLEAN DEFAULT false
  `);

  // Parental controls: account type on users (must exist before the
  // child-token cleanup below references it)
  await query(`
    ALTER TABLE vm_users
    ADD COLUMN IF NOT EXISTS account_type TEXT DEFAULT 'standard'
  `);

  // Child accounts never self-claim tokens: their credential is recovered only
  // through the authenticated parent route, so close the public claim window.
  await query(`
    UPDATE vm_users SET token_claimed = true
     WHERE account_type = 'child' AND token_claimed = false
  `);

  // Parent ↔ child relationships
  await query(`
    CREATE TABLE IF NOT EXISTS vm_parent_child (
      parent_id  UUID NOT NULL REFERENCES vm_users(id) ON DELETE CASCADE,
      child_id   UUID NOT NULL REFERENCES vm_users(id) ON DELETE CASCADE,
      created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
      PRIMARY KEY (parent_id, child_id)
    )
  `);
  await query(`
    ALTER TABLE vm_parent_child
    ADD COLUMN IF NOT EXISTS content_alert_last_sent_at BIGINT
  `);
  await query(`
    ALTER TABLE vm_parent_child
    ADD COLUMN IF NOT EXISTS content_alert_suppressed_count INT NOT NULL DEFAULT 0
  `);

  // Time-of-day restrictions per child
  await query(`
    CREATE TABLE IF NOT EXISTS vm_time_restrictions (
      child_id   UUID PRIMARY KEY REFERENCES vm_users(id) ON DELETE CASCADE,
      enabled    BOOLEAN DEFAULT false,
      start_hour INT DEFAULT 8,
      end_hour   INT DEFAULT 21,
      days       TEXT DEFAULT 'mon,tue,wed,thu,fri,sat,sun',
      override_until BIGINT
    )
  `);
  await query(`
    ALTER TABLE vm_time_restrictions
    ADD COLUMN IF NOT EXISTS override_until BIGINT
  `);

  // Contact approval list per child
  await query(`
    CREATE TABLE IF NOT EXISTS vm_contact_approvals (
      child_id      UUID NOT NULL REFERENCES vm_users(id) ON DELETE CASCADE,
      contact_id    UUID NOT NULL REFERENCES vm_users(id) ON DELETE CASCADE,
      status        TEXT DEFAULT 'pending',
      requested_at  BIGINT DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
      reviewed_at   BIGINT,
      PRIMARY KEY (child_id, contact_id)
    )
  `);

  // AI-flagged content per child
  await query(`
    CREATE TABLE IF NOT EXISTS vm_content_flags (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      child_id     UUID NOT NULL REFERENCES vm_users(id) ON DELETE CASCADE,
      message_id   UUID REFERENCES vm_messages(id) ON DELETE SET NULL,
      chat_id      UUID REFERENCES vm_chats(id) ON DELETE SET NULL,
      sender_id    UUID REFERENCES vm_users(id) ON DELETE SET NULL,
      flagged_text TEXT NOT NULL,
      severity     TEXT DEFAULT 'low',
      ai_reason    TEXT,
      is_reviewed  BOOLEAN DEFAULT false,
      created_at   BIGINT DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
    )
  `);

  // Private check-in groups and broadcasts. A broadcast is visible to every
  // group member, while each reply is visible only to its author and creator.
  await query(`
    CREATE TABLE IF NOT EXISTS vm_checkin_groups (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      description TEXT,
      anonymous BOOLEAN NOT NULL DEFAULT false,
      creator_id UUID NOT NULL REFERENCES vm_users(id) ON DELETE CASCADE,
      created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS vm_checkin_group_members (
      group_id UUID NOT NULL REFERENCES vm_checkin_groups(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES vm_users(id) ON DELETE CASCADE,
      joined_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
      PRIMARY KEY (group_id, user_id)
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_checkin_group_members_user ON vm_checkin_group_members (user_id, group_id)`);
  await query(`
    CREATE TABLE IF NOT EXISTS vm_broadcasts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      group_id UUID NOT NULL REFERENCES vm_checkin_groups(id) ON DELETE CASCADE,
      creator_id UUID NOT NULL REFERENCES vm_users(id) ON DELETE CASCADE,
      text TEXT NOT NULL DEFAULT '',
      audio_attachment JSONB,
      deadline BIGINT,
      client_id TEXT,
      created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
    )
  `);
  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_broadcasts_creator_client
      ON vm_broadcasts (creator_id, client_id) WHERE client_id IS NOT NULL
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_broadcasts_group_created ON vm_broadcasts (group_id, created_at DESC)`);
  await query(`
    CREATE TABLE IF NOT EXISTS vm_checkin_replies (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      broadcast_id UUID NOT NULL REFERENCES vm_broadcasts(id) ON DELETE CASCADE,
      member_id UUID NOT NULL REFERENCES vm_users(id) ON DELETE CASCADE,
      text TEXT NOT NULL DEFAULT '',
      audio_attachment JSONB,
      client_id TEXT,
      read_at BIGINT,
      created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
    )
  `);
  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_checkin_replies_member_client
      ON vm_checkin_replies (broadcast_id, member_id, client_id) WHERE client_id IS NOT NULL
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_checkin_replies_broadcast_created ON vm_checkin_replies (broadcast_id, created_at ASC)`);
  // vm_users.email + unique lower(email) (recover-email pack)
  await migrateUserEmail();

  // Sub-profiles: twin vm_users rows (account_type = 'agent') plus credentials.
  await query(`
    ALTER TABLE vm_users
    ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES vm_users(id) ON DELETE CASCADE
  `);
  await query(`
    ALTER TABLE vm_users
    ADD COLUMN IF NOT EXISTS profile_mode TEXT
  `);
  await query(`
    ALTER TABLE vm_users
    ADD COLUMN IF NOT EXISTS agent_provider TEXT
  `);
  await query(`
    ALTER TABLE vm_users
    ADD COLUMN IF NOT EXISTS agent_status TEXT
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS idx_vm_users_owner_user_id
      ON vm_users (owner_user_id)
      WHERE owner_user_id IS NOT NULL
  `);

  // Server-side E2E flag. Device encryption is still local; ciphertext that
  // matches the mobile AES prefix also marks the chat (see agent delivery).
  await query(`
    ALTER TABLE vm_chats
    ADD COLUMN IF NOT EXISTS is_e2e BOOLEAN NOT NULL DEFAULT false
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS vm_agent_credentials (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      agent_user_id UUID NOT NULL REFERENCES vm_users(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      hash TEXT,
      key_prefix TEXT,
      scopes TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
      webhook_url TEXT,
      secret_sealed TEXT,
      created_at BIGINT NOT NULL,
      last_used_at BIGINT,
      revoked_at BIGINT
    )
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS idx_vm_agent_credentials_agent
      ON vm_agent_credentials (agent_user_id)
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS idx_vm_agent_credentials_api_key_hash
      ON vm_agent_credentials (hash)
      WHERE kind = 'api_key' AND revoked_at IS NULL
  `);
  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS vm_agent_credentials_one_live_webhook
      ON vm_agent_credentials (agent_user_id)
      WHERE kind = 'webhook' AND revoked_at IS NULL
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS vm_agent_audit (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      agent_user_id UUID NOT NULL REFERENCES vm_users(id) ON DELETE CASCADE,
      action TEXT NOT NULL,
      chat_id UUID,
      detail JSONB,
      at BIGINT NOT NULL
    )
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS idx_vm_agent_audit_agent_at
      ON vm_agent_audit (agent_user_id, at DESC)
  `);

  // In-chat calendar slot cards. Yes/No is a single owner or chat-admin tap.
  await query(`
    CREATE TABLE IF NOT EXISTS vm_calendar_proposals (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      agent_user_id UUID NOT NULL REFERENCES vm_users(id) ON DELETE CASCADE,
      owner_user_id UUID NOT NULL REFERENCES vm_users(id) ON DELETE CASCADE,
      chat_id UUID NOT NULL REFERENCES vm_chats(id) ON DELETE CASCADE,
      message_id UUID REFERENCES vm_messages(id) ON DELETE SET NULL,
      client_id TEXT,
      title TEXT NOT NULL,
      starts_at BIGINT NOT NULL,
      ends_at BIGINT NOT NULL,
      note TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      decided_by UUID REFERENCES vm_users(id) ON DELETE SET NULL,
      decided_at BIGINT,
      calendar_write TEXT NOT NULL DEFAULT 'not_attempted',
      created_at BIGINT NOT NULL
    )
  `);
  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS vm_calendar_proposals_agent_client
      ON vm_calendar_proposals (agent_user_id, client_id)
      WHERE client_id IS NOT NULL
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS idx_vm_calendar_proposals_chat
      ON vm_calendar_proposals (chat_id, created_at DESC)
  `);
}
