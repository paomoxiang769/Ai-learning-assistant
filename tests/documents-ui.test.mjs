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
const globalsSource = await readFile(
  new URL("../src/app/globals.css", import.meta.url),
  "utf8",
);

test("documents page renders a source library shelf workspace", () => {
  assert.match(documentsPageSource, /workspace-dashboard-header/);
  assert.match(documentsPageSource, /source-library-shell/);
  assert.match(documentsPageSource, /source-upload-dock/);
  assert.match(documentsPageSource, /DocumentsSearchList/);
  assert.match(documentsSearchListSource, /source-shelf-grid/);
  assert.match(documentsSearchListSource, /source-lane-marker/);
  assert.match(documentsSearchListSource, /Search document titles/);
});

test("documents workspace uses dashboard-like upload and shelf cards", () => {
  assert.match(documentsPageSource, /Library size/);
  assert.match(globalsSource, /\.workspace-dashboard-header\s*\{/);
  assert.match(globalsSource, /\.source-upload-dock\s*\{[^}]*border-radius:\s*12px;/s);
  assert.match(globalsSource, /\.source-file-card\s*\{[^}]*border-radius:\s*12px;/s);
  assert.match(globalsSource, /\.source-library-meter\s*\{[^}]*background:\s*linear-gradient/s);
});
