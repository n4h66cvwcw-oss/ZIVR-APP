import assert from "node:assert/strict";
import test from "node:test";
import { createHmac } from "node:crypto";
import { MAX_IMAGE_BYTES, MAX_MESSAGE_REQUEST_BYTES } from "./limits.js";
import { decodedBase64Bytes } from "./media.js";
import { parseCalendarProposeArgs, parseReadNewArgs, parseSendMessageArgs } from "./validate.js";
import { verifyWebhookSignature, webhookSignature } from "./webhook.js";

const CHAT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PEER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const TINY_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const TINY_PDF = "data:application/pdf;base64,JVBERi0xLjEKJcKlwrE=";

test("send requires clientId and exactly one destination", () => {
  const missingClient = parseSendMessageArgs({ chatId: CHAT, text: "hi" });
  assert.equal(missingClient.ok, false);
  if (!missingClient.ok) assert.equal(missingClient.error, "clientId is required");
  const both = parseSendMessageArgs({ chatId: CHAT, peerId: PEER, text: "hi", clientId: "c" });
  assert.equal(both.ok, false);
  if (!both.ok) assert.equal(both.error, "Provide exactly one of chatId or peerId");
  const neither = parseSendMessageArgs({ text: "hi", clientId: "c" });
  assert.equal(neither.ok, false);
  if (!neither.ok) assert.equal(neither.error, "Provide exactly one of chatId or peerId");
  const bad = parseSendMessageArgs({ chatId: "not-a-uuid", text: "hi", clientId: "c" });
  assert.equal(bad.ok, false);
  if (!bad.ok) assert.match(bad.error, /chatId must be a UUID/);
});

test("send accepts a same-owner peer, trims clientId, and drops a null chatId", () => {
  const parsed = parseSendMessageArgs({ chatId: null, peerId: PEER, text: "  hello  ", clientId: "  id-1  " });
  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    assert.equal(parsed.value.peerId, PEER);
    assert.equal(parsed.value.chatId, undefined);
    assert.equal(parsed.value.text, "  hello  ");
    assert.equal(parsed.value.clientId, "id-1");
  }
});

test("send normalizes an image or PDF and rejects video, extra files, and empty text", () => {
  const image = parseSendMessageArgs({
    peerId: PEER,
    text: "",
    clientId: "img",
    media: { kind: "image", dataUrl: TINY_PNG.replace("image/png", "image/jpg") },
  });
  assert.equal(image.ok, true);
  if (image.ok && image.value.media?.kind === "image") {
    assert.equal(image.value.media.mimeType, "image/jpeg");
    assert.equal(image.value.media.security, "none");
    assert.match(image.value.media.dataUrl, /^data:image\/jpeg;base64,/);
  }

  const pdf = parseSendMessageArgs({
    chatId: CHAT,
    text: " spec ",
    clientId: "pdf",
    media: { kind: "file", dataUrl: TINY_PDF, fileName: "../secrets.pdf" },
  });
  assert.equal(pdf.ok, true);
  if (pdf.ok && pdf.value.media?.kind === "file") {
    assert.equal(pdf.value.media.fileName, "secrets.pdf");
    assert.equal(pdf.value.text, "spec");
  }

  const video = parseSendMessageArgs({
    chatId: CHAT,
    text: "",
    clientId: "vid",
    media: { kind: "file", dataUrl: "data:video/mp4;base64,AAAA" },
  });
  assert.equal(video.ok, false);
  if (!video.ok) assert.match(video.error, /Video and audio/);

  const many = parseSendMessageArgs({
    chatId: CHAT,
    text: "two",
    clientId: "two",
    media: [{ dataUrl: TINY_PDF }, { dataUrl: TINY_PNG }],
  });
  assert.equal(many.ok, false);
  if (!many.ok) assert.equal(many.error, "One attachment per message");

  const empty = parseSendMessageArgs({ chatId: CHAT, text: "   ", clientId: "e" });
  assert.equal(empty.ok, false);
  if (!empty.ok) assert.equal(empty.error, "text or an image/PDF is required");

  const card = parseSendMessageArgs({
    chatId: CHAT,
    text: "approve",
    clientId: "card",
    media: { kind: "calendar_proposal", status: "approved" },
  });
  assert.equal(card.ok, false);
});

test("send rejects attachments over the API caps", () => {
  const tooLong = `data:application/pdf;base64,${"A".repeat(MAX_MESSAGE_REQUEST_BYTES)}`;
  const long = parseSendMessageArgs({ chatId: CHAT, text: "big", clientId: "big", media: { dataUrl: tooLong } });
  assert.equal(long.ok, false);

  const len = Math.ceil((MAX_IMAGE_BYTES + 3) / 3) * 4;
  const oversized = parseSendMessageArgs({
    chatId: CHAT,
    text: "",
    clientId: "size",
    media: { kind: "file", dataUrl: `data:text/plain;base64,${"A".repeat(len)}`, fileName: "notes.txt" },
  });
  assert.equal(oversized.ok, false);
  if (!oversized.ok) assert.match(oversized.error, /too large/);
  assert.ok(decodedBase64Bytes("A".repeat(len)) > MAX_IMAGE_BYTES);
});

test("read cursor and calendar slot rules match the agent API", () => {
  assert.deepEqual(parseReadNewArgs({}), { ok: true, value: {} });
  assert.deepEqual(parseReadNewArgs({ since: "15" }), { ok: true, value: { since: 15 } });
  assert.deepEqual(parseReadNewArgs({ since: null }), { ok: true, value: {} });
  const negative = parseReadNewArgs({ since: -1 });
  assert.equal(negative.ok, false);
  if (!negative.ok) assert.match(negative.error, /since/);

  const now = 1_700_000_000_000;
  const startsAt = now + 60 * 60 * 1000;
  const endsAt = startsAt + 30 * 60 * 1000;
  const ok = parseCalendarProposeArgs({
    chatId: CHAT,
    title: " Lunch ",
    startsAt: String(startsAt),
    endsAt,
    note: " downtown ",
    clientId: " cal ",
  }, now);
  assert.equal(ok.ok, true);
  if (ok.ok) {
    assert.equal(ok.value.title, "Lunch");
    assert.equal(ok.value.note, "downtown");
    assert.equal(ok.value.clientId, "cal");
    assert.equal(ok.value.startsAt, startsAt);
  }

  const past = parseCalendarProposeArgs({
    chatId: CHAT,
    title: "Old",
    startsAt: now - 5 * 60 * 1000 - 1,
    endsAt: now,
    clientId: "old",
  }, now);
  assert.equal(past.ok, false);
  if (!past.ok) assert.equal(past.error, "The slot is in the past");

  const peer = parseCalendarProposeArgs({ peerId: PEER, chatId: CHAT, title: "X", startsAt, endsAt, clientId: "p" }, now);
  assert.equal(peer.ok, false);
  if (!peer.ok) assert.match(peer.error, /chatId/);

  const missing = parseCalendarProposeArgs({ chatId: CHAT, startsAt, endsAt, clientId: "t" }, now);
  assert.equal(missing.ok, false);
  if (!missing.ok) assert.equal(missing.error, "title is required");
});

test("webhook signature is sha256 over the raw body", () => {
  const secret = "test-secret";
  const body = JSON.stringify({ type: "message.created", chatId: CHAT });
  const expected = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
  assert.equal(webhookSignature(secret, body), expected);
  assert.equal(verifyWebhookSignature(secret, body, expected), true);
  const flipped = `${expected.slice(0, -1)}${expected.endsWith("0") ? "1" : "0"}`;
  assert.equal(verifyWebhookSignature(secret, body, flipped), false);
  assert.equal(verifyWebhookSignature(secret, `${body} `, expected), false);
  assert.equal(verifyWebhookSignature(secret, body, undefined), false);
  assert.equal(verifyWebhookSignature(secret, body, "sha256=abc"), false);
});
