import assert from "node:assert/strict";
import test from "node:test";
import { hashRecoveryCode } from "./recovery-code";
import { phoneLookupCandidates } from "./recover-email";
import { processRecoveryEmailRequest, type RecoverEmailDeps } from "./recover-email-service";

type User = { id: string; displayName: string; email: string | null; phone: string | null; hash: string | null; ack: boolean };

function harness(users: User[], opts: { configured?: boolean; sendFails?: boolean } = {}) {
  const sent: { to: string; code: string }[] = [];
  const logs: string[] = [];
  const deps: RecoverEmailDeps = {
    isMailConfigured: () => opts.configured ?? true,
    sendRecoveryCodeEmail: async ({ to, code }) => {
      if (opts.sendFails) throw new Error("smtp down");
      sent.push({ to, code });
    },
    log: { info: (_o, m) => logs.push(m), warn: (_o, m) => logs.push(m), error: (_o, m) => logs.push(m) },
    query: async <T,>(sql: string, params: unknown[] = []): Promise<T[]> => {
      const row = (u: User) => ({ id: u.id, displayName: u.displayName, email: u.email, prevHash: u.hash, prevAck: u.ack });
      if (sql.includes("lower(email) = $1")) {
        return users.filter((u) => u.email?.toLowerCase() === params[0]).map(row) as T[];
      }
      if (sql.includes("phone = ANY")) {
        const [exact, digits] = params as [string[], string[]];
        return users
          .filter((u) => u.phone && (exact.includes(u.phone) || digits.includes(u.phone.replace(/\D/g, ""))))
          .map(row) as T[];
      }
      if (sql.includes("recovery_code_hash = $4")) {
        const [prevHash, prevAck, id, newHash] = params as [string | null, boolean, string, string];
        const u = users.find((x) => x.id === id && x.hash === newHash);
        if (u) { u.hash = prevHash; u.ack = prevAck; }
        return [];
      }
      if (sql.includes("SET recovery_code_hash = $1")) {
        const u = users.find((x) => x.id === params[1]);
        if (u) { u.hash = params[0] as string; u.ack = false; }
        return [];
      }
      throw new Error(`unexpected sql: ${sql}`);
    },
  };
  return { deps, sent, logs };
}

const jay = (): User => ({ id: "u1", displayName: "Jay", email: "Jay@Zivr.app", phone: "+17608803807", hash: "oldhash", ack: true });

test("email lookup: mints, persists hash, emails the plaintext", async () => {
  const users = [jay()];
  const h = harness(users);
  const out = await processRecoveryEmailRequest({ kind: "email", email: "jay@zivr.app" }, h.deps);
  assert.equal(out, "sent");
  assert.equal(h.sent.length, 1);
  assert.equal(h.sent[0]!.to, "Jay@Zivr.app");
  assert.equal(users[0]!.hash, hashRecoveryCode(h.sent[0]!.code));
  assert.equal(users[0]!.ack, false);
});

test("phone lookup (legacy digit format in DB) still finds the account", async () => {
  const users = [{ ...jay(), phone: "(760) 880-3807" }];
  const h = harness(users);
  const out = await processRecoveryEmailRequest({ kind: "phone", phone: phoneLookupCandidates("+17608803807")! }, h.deps);
  assert.equal(out, "sent");
});

test("no match / no email on file / ambiguous never send", async () => {
  const noEmail = harness([{ ...jay(), email: null }]);
  assert.equal(await processRecoveryEmailRequest({ kind: "phone", phone: phoneLookupCandidates("7608803807")! }, noEmail.deps), "no_email_on_file");
  const none = harness([jay()]);
  assert.equal(await processRecoveryEmailRequest({ kind: "email", email: "nobody@x.io" }, none.deps), "no_match");
  const dup = harness([jay(), { ...jay(), id: "u2", phone: "7608803807" }]);
  assert.equal(await processRecoveryEmailRequest({ kind: "phone", phone: phoneLookupCandidates("7608803807")! }, dup.deps), "ambiguous");
  for (const h of [noEmail, none, dup]) assert.equal(h.sent.length, 0);
});

test("SMTP not configured: nothing minted", async () => {
  const users = [jay()];
  const h = harness(users, { configured: false });
  assert.equal(await processRecoveryEmailRequest({ kind: "email", email: "jay@zivr.app" }, h.deps), "mail_not_configured");
  assert.equal(users[0]!.hash, "oldhash");
});

test("send failure restores the previous hash + ack", async () => {
  const users = [jay()];
  const h = harness(users, { sendFails: true });
  assert.equal(await processRecoveryEmailRequest({ kind: "email", email: "jay@zivr.app" }, h.deps), "send_failed");
  assert.equal(users[0]!.hash, "oldhash");
  assert.equal(users[0]!.ack, true);
});
