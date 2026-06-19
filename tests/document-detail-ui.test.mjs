import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const documentDetailSource = await readFile(
  new URL("../src/app/documents/[id]/page.tsx", import.meta.url),
  "utf8",
);

test("document detail page renders the workspace tab shell", () => {
  assert.match(documentDetailSource, /DocumentWorkspaceTabs/);
  assert.match(documentDetailSource, /initialTab/);
  assert.match(documentDetailSource, /overviewContent/);
  assert.match(documentDetailSource, /chatContent/);
  assert.match(documentDetailSource, /quizContent/);
  assert.match(documentDetailSource, /notesContent/);
  assert.match(documentDetailSource, /flashcardsContent/);
  assert.doesNotMatch(documentDetailSource, /paper-sync-shell/);
});

test("document detail overview keeps summary, stats, and raw text collapsed", () => {
  assert.match(documentDetailSource, /Document statistics/);
  assert.match(documentDetailSource, /AI Summary/);
  assert.match(documentDetailSource, /<details className="document-raw-text-disclosure">/);
  assert.match(documentDetailSource, /<summary>Raw Text Preview<\/summary>/);
});

test("document detail page preserves quiz and note deep-link targets", () => {
  assert.match(
    documentDetailSource,
    /const initialWorkspaceTab = query\.quizId\s+\? "quiz"\s+:\s+query\.noteId\s+\? "notes"\s+:\s+"overview";/,
  );
  assert.match(documentDetailSource, /initialQuizId=\{query\.quizId\}/);
  assert.match(documentDetailSource, /initialNoteId=\{query\.noteId\}/);
});

test("document detail page wires the flashcards workspace tab", async () => {
  const workspaceTabsSource = await readFile(
    new URL("../src/app/documents/[id]/document-workspace-tabs.tsx", import.meta.url),
    "utf8",
  );
  const flashcardsPanelSource = await readFile(
    new URL("../src/app/documents/[id]/study-flashcards-panel.tsx", import.meta.url),
    "utf8",
  );

  assert.match(documentDetailSource, /StudyFlashcardsPanel/);
  assert.match(workspaceTabsSource, /"flashcards"/);
  assert.match(workspaceTabsSource, /Flashcards/);
  assert.match(flashcardsPanelSource, /Generate Flashcards/);
  assert.match(flashcardsPanelSource, /Flashcards History/);
  assert.match(flashcardsPanelSource, /\/api\/study\/flashcards\/generate/);
  assert.match(flashcardsPanelSource, /\/api\/study\/flashcards/);
  assert.match(flashcardsPanelSource, /Flip Card/);
  assert.match(flashcardsPanelSource, /Previous/);
  assert.match(flashcardsPanelSource, /Next/);
  assert.match(flashcardsPanelSource, /Delete/);
});

test("document detail page uses the shared delete confirmation UI", () => {
  assert.match(documentDetailSource, /DeleteDocumentForm/);
  assert.doesNotMatch(documentDetailSource, /<form action=.*delete/);
});
