import { query } from "./db";

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

  // Parental controls: account type on users
  await query(`
    ALTER TABLE vm_users
    ADD COLUMN IF NOT EXISTS account_type TEXT DEFAULT 'standard'
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

  // Time-of-day restrictions per child
  await query(`
    CREATE TABLE IF NOT EXISTS vm_time_restrictions (
      child_id   UUID PRIMARY KEY REFERENCES vm_users(id) ON DELETE CASCADE,
      enabled    BOOLEAN DEFAULT false,
      start_hour INT DEFAULT 8,
      end_hour   INT DEFAULT 21,
      days       TEXT DEFAULT 'mon,tue,wed,thu,fri,sat,sun'
    )
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
}
