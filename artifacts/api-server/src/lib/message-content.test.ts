import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_IMAGE_BYTES,
  prepareOutgoingMessage,
  serializeHistoryMessage,
} from "./message-content.ts";

const TINY_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function imageMedia(dataUrl: string = TINY_PNG) {
  return { kind: "image" as const, mimeType: "image/png", dataUrl, security: "none" as const };
}

test("empty text is rejected when no image is attached", () => {
  for (const text of ["", "   ", "\n\t"]) {
    const result = prepareOutgoingMessage({ text, type: "text" });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error, "Message text is required");
  }
  const missing = prepareOutgoingMessage({ type: "text" });
  assert.equal(missing.ok, false);
  if (!missing.ok) assert.equal(missing.error, "Message text is required");
});

test("empty text is accepted when a valid image is attached", () => {
  for (const text of ["", "   ", undefined]) {
    const result = prepareOutgoingMessage({ text, type: "image", media: imageMedia() });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.message.text, "");
      assert.equal(result.message.type, "image");
      assert.equal(result.message.media?.kind, "image");
      if (result.message.media?.kind === "image") {
        assert.equal(result.message.media.dataUrl, TINY_PNG);
        assert.equal(result.message.media.mimeType, "image/png");
      }
    }
  }
});

test("text-only messages still send and do not invent media", () => {
  const result = prepareOutgoingMessage({ text: "hello", type: "text" });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.message.text, "hello");
    assert.equal(result.message.type, "text");
    assert.equal(result.message.media, null);
  }
});

test("image plus caption keeps the caption and image type", () => {
  const result = prepareOutgoingMessage({ text: " look ", type: "image", media: imageMedia() });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.message.text, "look");
    assert.equal(result.message.type, "image");
    assert.ok(result.message.media);
  }
});

test("oversized and non-image payloads are rejected", () => {
  const huge = "A".repeat(Math.ceil(((MAX_IMAGE_BYTES + 8) * 4) / 3));
  const oversized = prepareOutgoingMessage({
    text: "",
    type: "image",
    media: imageMedia(`data:image/jpeg;base64,${huge}`),
  });
  assert.equal(oversized.ok, false);
  if (!oversized.ok) assert.match(oversized.error, /too large/);

  const remote = prepareOutgoingMessage({
    text: "",
    type: "image",
    media: imageMedia("https://example.com/photo.jpg"),
  });
  assert.equal(remote.ok, false);
  if (!remote.ok) assert.equal(remote.error, "Image attachment is invalid");
});

test("history JSON always emits numeric createdAt", () => {
  const payload = {
    messages: [
      serializeHistoryMessage({
        id: "m1",
        chatId: "c1",
        senderId: "u1",
        senderName: "Jay",
        text: "hi",
        type: "text",
        createdAt: "1793663279877",
        localId: "local-1",
      }),
      serializeHistoryMessage({
        id: "m2",
        chatId: "c1",
        senderId: "u1",
        senderName: "Jay",
        text: "",
        type: "image",
        createdAt: 1793663279888,
        media: imageMedia(),
      }),
    ],
  };
  const json = JSON.parse(JSON.stringify(payload)) as {
    messages: Array<{ createdAt: unknown; type: string; media?: { dataUrl: string } }>;
  };
  assert.equal(typeof json.messages[0]?.createdAt, "number");
  assert.equal(json.messages[0]?.createdAt, 1793663279877);
  assert.equal(typeof json.messages[1]?.createdAt, "number");
  assert.equal(json.messages[1]?.createdAt, 1793663279888);
  assert.equal(json.messages[1]?.media?.dataUrl, TINY_PNG);
  assert.equal(Number.isNaN(new Date(String(json.messages[0]?.createdAt)).getTime()), true);
  assert.equal(Number.isNaN(new Date(json.messages[0]?.createdAt as number).getTime()), false);
});
