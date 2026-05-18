import { query } from "./db";

export async function migrate(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS vm_users (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      display_name    TEXT NOT NULL,
      username        TEXT UNIQUE,
      phone           TEXT,
      avatar          TEXT,
      status_message  TEXT DEFAULT 'Hey there! I''m on ZIVR',
      push_token      TEXT,
      is_online       BOOLEAN DEFAULT false,
      last_seen       BIGINT DEFAULT 0,
      created_at      BIGINT DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
    )
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
}
