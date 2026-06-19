import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const documentsPageSource = await readFile(
  new URL("../src/app/documents/page.tsx", import.meta.url),
  "utf8",
);
const documentsSearchListSource = await readFile(
  new URL("../src/app/documents/documents-search-list.tsx", import.meta.url),
  "utf8",
);

test("documents page renders a source library shelf workspace", () => {
  assert.match(documentsPageSource, /source-library-shell/);
  assert.match(documentsPageSource, /source-upload-dock/);
  assert.match(documentsPageSource, /DocumentsSearchList/);
  assert.match(documentsSearchListSource, /source-shelf-grid/);
  assert.match(documentsSearchListSource, /source-lane-marker/);
  assert.match(documentsSearchListSource, /Search document titles/);
});
