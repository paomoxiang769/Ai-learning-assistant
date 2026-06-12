import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const reviewCenterSource = await readFile(
  new URL("../src/app/review/page.tsx", import.meta.url),
  "utf8",
);

test("review center renders a history drawer workspace", () => {
  assert.match(reviewCenterSource, /review-drawer-shell/);
  assert.match(reviewCenterSource, /review-signal-rail/);
  assert.match(reviewCenterSource, /review-history-drawer/);
  assert.match(reviewCenterSource, /review-lane-marker/);
});

test("review center mirrors the target AI review command rail", () => {
  assert.match(reviewCenterSource, /Review Nexus/);
  assert.match(reviewCenterSource, /AI review lanes/);
  assert.match(reviewCenterSource, /review-command-card/);
  assert.match(reviewCenterSource, /review-signal-chip/);
});
