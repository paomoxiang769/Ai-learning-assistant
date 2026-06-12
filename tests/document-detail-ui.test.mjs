import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const documentDetailSource = await readFile(
  new URL("../src/app/documents/[id]/page.tsx", import.meta.url),
  "utf8",
);

test("document detail page renders the Paper Sync reader shell", () => {
  assert.match(documentDetailSource, /paper-sync-shell/);
  assert.match(documentDetailSource, /paper-sync-header/);
  assert.match(documentDetailSource, /paper-sync-status-grid/);
  assert.match(documentDetailSource, /paper-sync-extract-panel/);
});

test("document detail page mirrors the target Paper Sync three-column layout", () => {
  assert.match(documentDetailSource, /paper-sync-outline/);
  assert.match(documentDetailSource, /Current mounted document/);
  assert.match(documentDetailSource, /Document knowledge index/);
  assert.match(documentDetailSource, /AI companion alignment/);
});

test("document detail page uses the shared delete confirmation UI", () => {
  assert.match(documentDetailSource, /DeleteDocumentForm/);
  assert.doesNotMatch(documentDetailSource, /<form action=.*delete/);
});
