import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const chatFormSource = await readFile(
  new URL("../src/app/chat/knowledge-base-chat-form.tsx", import.meta.url),
  "utf8",
);
const chatPageSource = await readFile(
  new URL("../src/app/chat/page.tsx", import.meta.url),
  "utf8",
);
const globalsSource = await readFile(
  new URL("../src/app/globals.css", import.meta.url),
  "utf8",
);

test("knowledge page uses the dashboard-like workspace header", () => {
  assert.match(chatPageSource, /workspace-dashboard-header/);
  assert.match(chatPageSource, /Knowledge Base/);
  assert.match(chatPageSource, /Cross-document/);
});

test("knowledge chat renders a prompt dock and source rail", () => {
  assert.match(chatFormSource, /knowledge-command-shell/);
  assert.match(chatFormSource, /knowledge-prompt-dock/);
  assert.match(chatFormSource, /knowledge-source-rail/);
  assert.match(chatFormSource, /knowledge-answer-stream/);
});

test("knowledge chat keeps citations visible behind a source disclosure", () => {
  assert.match(chatFormSource, /<details className="source-panel">/);
  assert.match(chatFormSource, /getSourcesSummaryLabel\(message\.sources\.length\)/);
  assert.match(chatFormSource, /Answer stream/);
  assert.match(chatFormSource, /knowledge-answer-toolbar/);
});

test("knowledge workspace CSS matches the compact dashboard card style", () => {
  assert.match(globalsSource, /\.workspace-dashboard-header\s*\{/);
  assert.match(globalsSource, /\.knowledge-console-grid\s*\{/);
  assert.match(globalsSource, /\.knowledge-answer-toolbar\s*\{/);
  assert.match(globalsSource, /\.knowledge-source-rail\s*\{[^}]*border-radius:\s*12px;/s);
});
