import assert from "node:assert/strict";
import test from "node:test";
import {
  formatMessageTime,
  imageAttachmentFromServerMedia,
  localMessageFromServer,
} from "./message-time.ts";
import {
  imageMediaFromParts,
  removeOutboxEntry,
  restMessageBody,
  socketMessagePayload,
  upsertOutboxEntry,
  type MessageOutboxEntry,
} from "./message-outbox.ts";

const TINY_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

test("formatMessageTime accepts numeric strings that Date would reject", () => {
  const fromString = formatMessageTime("1793663279877");
  const fromNumber = formatMessageTime(1793663279877);
  assert.equal(fromString, fromNumber);
  assert.notEqual(fromString, "");
  assert.equal(fromString.includes("Invalid"), false);
  assert.equal(Number.isNaN(new Date("1793663279877").getTime()), true);
});

test("formatMessageTime leaves unparseable values blank", () => {
  assert.equal(formatMessageTime("not-a-date"), "");
  assert.equal(formatMessageTime(undefined), "");
});

test("outbox entries keep image media with the text fields", () => {
  const prepared = imageMediaFromParts({
    base64: TINY_PNG,
    mimeType: "image/png",
    security: "none",
    width: 12,
    height: 8,
  });
  assert.equal(prepared.ok, true);
  if (!prepared.ok) return;
  const entry: MessageOutboxEntry = {
    chatId: "chat-1",
    text: "",
    localId: "local-1",
    ownerUserId: "user-1",
    media: prepared.media,
  };
  const queued = upsertOutboxEntry([], entry);
  assert.equal(queued.length, 1);
  assert.equal(queued[0]?.text, "");
  assert.equal(queued[0]?.media?.kind, "image");
  assert.equal(queued[0]?.media?.dataUrl.startsWith("data:image/png;base64,"), true);
  assert.deepEqual(removeOutboxEntry(queued, "user-1", "local-1"), []);
});

test("image-only and image+caption use the same media data URL on socket and REST", () => {
  const prepared = imageMediaFromParts({ base64: TINY_PNG, mimeType: "image/png", security: "none" });
  assert.equal(prepared.ok, true);
  if (!prepared.ok) return;
  const imageOnly = socketMessagePayload({ chatId: "chat-1", text: "", localId: "local-1", media: prepared.media });
  assert.equal(imageOnly.type, "image");
  assert.equal(imageOnly.text, "");
  assert.equal(imageOnly.media?.dataUrl, prepared.media.dataUrl);
  const captioned = restMessageBody({ text: "look", localId: "local-2", media: prepared.media });
  assert.equal(captioned.type, "image");
  assert.equal(captioned.text, "look");
  assert.equal(captioned.clientId, "local-2");
  assert.equal(captioned.media?.dataUrl, prepared.media.dataUrl);
  assert.deepEqual(restMessageBody({ text: "hello", localId: "local-3" }), {
    text: "hello",
    type: "text",
    clientId: "local-3",
  });
});

test("inbound server media becomes the bubble imageAttachment", () => {
  const prepared = imageMediaFromParts({ base64: TINY_PNG, mimeType: "image/png", security: "none" });
  assert.equal(prepared.ok, true);
  if (!prepared.ok) return;
  const local = localMessageFromServer({
    id: "server-1",
    chatId: "chat-1",
    senderId: "user-2",
    text: "",
    type: "image",
    createdAt: "1793663279877",
    media: prepared.media,
  });
  assert.equal(local.timestamp, 1793663279877);
  assert.equal(local.imageAttachment?.uri, prepared.media.dataUrl);
  assert.equal(imageAttachmentFromServerMedia(null), undefined);
});
