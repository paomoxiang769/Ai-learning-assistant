import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const documentsPageSource = await readFile(
  new URL("../src/app/documents/page.tsx", import.meta.url),
  "utf8",
);

test("documents page renders a source library shelf workspace", () => {
  assert.match(documentsPageSource, /source-library-shell/);
  assert.match(documentsPageSource, /source-upload-dock/);
  assert.match(documentsPageSource, /source-shelf-grid/);
  assert.match(documentsPageSource, /source-lane-marker/);
});
