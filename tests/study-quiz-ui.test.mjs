import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const quizPanelSource = await readFile(
  new URL("../src/app/documents/[id]/study-quiz-panel.tsx", import.meta.url),
  "utf8",
);

test("study quiz cards render a tactile flip structure", () => {
  assert.match(quizPanelSource, /tactile-flip-card/);
  assert.match(quizPanelSource, /tactile-card-face tactile-card-front/);
  assert.match(quizPanelSource, /tactile-card-face tactile-card-back/);
  assert.match(quizPanelSource, /isAnswerVisible \? " is-revealed" : ""/);
});

test("study quiz arena renders an AI review feedback panel", () => {
  assert.match(quizPanelSource, /tactile-quiz-feedback/);
  assert.match(quizPanelSource, /Review pacing/);
  assert.match(quizPanelSource, /Remaining cards/);
});
