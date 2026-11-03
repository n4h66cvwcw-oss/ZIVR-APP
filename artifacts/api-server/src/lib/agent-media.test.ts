import assert from "node:assert/strict";
import test from "node:test";
import {
  parseStoredMedia,
  prepareAgentOutgoingMessage,
  prepareOutgoingMessage,
} from "./message-content.ts";

const TINY_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const TINY_PDF = "data:application/pdf;base64,JVBERi0xLjEKJcKlwrE=";

test("agents can send an allow-listed document and not video", () => {
  const pdf = prepareAgentOutgoingMessage({
    text: "notes",
    media: { kind: "file", mimeType: "application/pdf", dataUrl: TINY_PDF, fileName: "notes.pdf" },
  });
  assert.equal(pdf.ok, true);
  if (pdf.ok) {
    assert.equal(pdf.message.type, "file");
    assert.equal(pdf.message.media?.kind, "file");
  }

  const video = prepareAgentOutgoingMessage({
    text: "",
    media: { kind: "file", dataUrl: "data:video/mp4;base64,AAAA" },
  });
  assert.equal(video.ok, false);
  if (!video.ok) assert.match(video.error, /Video and audio/);

  const human = prepareOutgoingMessage({
    text: "",
    media: { kind: "file", dataUrl: TINY_PDF },
  });
  assert.equal(human.ok, false);
});

test("agents still send images and cannot forge a calendar card", () => {
  const image = prepareAgentOutgoingMessage({
    text: "",
    media: { kind: "image", mimeType: "image/png", dataUrl: TINY_PNG, security: "none" },
  });
  assert.equal(image.ok, true);
  if (image.ok) assert.equal(image.message.type, "image");

  const forged = prepareAgentOutgoingMessage({
    text: "approve me",
    media: { kind: "calendar_proposal", status: "approved" },
  });
  assert.equal(forged.ok, false);
});

test("stored calendar cards and files survive history parsing", () => {
  const card = parseStoredMedia({
    kind: "calendar_proposal",
    proposalId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    title: "Standup",
    startsAt: 1_800_000_000_000,
    endsAt: 1_800_001_800_000,
    status: "pending",
    approval: "owner_or_admin",
  });
  assert.equal(card?.kind, "calendar_proposal");
  if (card?.kind === "calendar_proposal") assert.equal(card.approval, "owner_or_admin");

  const file = parseStoredMedia({ kind: "file", mimeType: "application/pdf", dataUrl: TINY_PDF, fileName: "../secrets.pdf" });
  assert.equal(file?.kind, "file");
  if (file?.kind === "file") assert.equal(file.fileName, "secrets.pdf");

  const image = parseStoredMedia({ kind: "image", mimeType: "image/png", dataUrl: TINY_PNG, security: "none" });
  assert.equal(image?.kind, "image");
});
