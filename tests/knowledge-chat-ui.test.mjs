import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const chatFormSource = await readFile(
  new URL("../src/app/chat/knowledge-base-chat-form.tsx", import.meta.url),
  "utf8",
);

test("knowledge chat renders a prompt dock and source rail", () => {
  assert.match(chatFormSource, /knowledge-command-shell/);
  assert.match(chatFormSource, /knowledge-prompt-dock/);
  assert.match(chatFormSource, /knowledge-source-rail/);
  assert.match(chatFormSource, /knowledge-answer-stream/);
});
