import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const notesPanelSource = await readFile(
  new URL("../src/app/documents/[id]/study-notes-panel.tsx", import.meta.url),
  "utf8",
);

test("study notes panel includes note search", () => {
  assert.match(notesPanelSource, /noteSearchQuery/);
  assert.match(notesPanelSource, /Search note titles and content/);
});

test("study notes deep links scroll to loaded note preview", () => {
  assert.match(notesPanelSource, /notePreviewRef/);
  assert.match(notesPanelSource, /ref=\{notePreviewRef\}/);
  assert.match(notesPanelSource, /notePreviewRef\.current\?\.scrollIntoView/);
});
