import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const reviewCenterSource = await readFile(
  new URL("../src/app/review/page.tsx", import.meta.url),
  "utf8",
);
const reviewCenterSearchSource = await readFile(
  new URL("../src/app/review/review-center-search.tsx", import.meta.url),
  "utf8",
);
const globalsSource = await readFile(
  new URL("../src/app/globals.css", import.meta.url),
  "utf8",
);

test("review center renders a history drawer workspace", () => {
  assert.match(reviewCenterSource, /workspace-dashboard-header/);
  assert.match(reviewCenterSource, /review-drawer-shell/);
  assert.match(reviewCenterSource, /review-signal-rail/);
  assert.match(reviewCenterSource, /ReviewCenterSearch/);
  assert.match(reviewCenterSearchSource, /review-main-panel/);
  assert.match(reviewCenterSearchSource, /review-history-drawer/);
  assert.match(reviewCenterSearchSource, /review-lane-marker/);
  assert.match(reviewCenterSearchSource, /Search recent chats, notes, quizzes, flashcards/);
});

test("review center renders recent flashcards", () => {
  assert.match(reviewCenterSource, /recentFlashcards/);
  assert.match(reviewCenterSearchSource, /Recent Flashcards/);
  assert.match(reviewCenterSearchSource, /flashcards/);
});

test("review center keeps search and result lanes in the main content column", () => {
  assert.match(globalsSource, /\.review-main-panel\s*\{/);
  assert.match(globalsSource, /grid-column:\s*2;/);
  assert.match(globalsSource, /min-width:\s*0;/);
  assert.match(globalsSource, /\.review-workspace-grid\s*\{/);
  assert.match(globalsSource, /repeat\(auto-fit,\s*minmax\(min\(100%,\s*18rem\),\s*1fr\)\)/);
  assert.match(globalsSource, /align-items:\s*start;/);
  assert.match(globalsSource, /\.review-history-drawer\s*\{[^}]*align-content:\s*start;/s);
  assert.match(globalsSource, /\.review-history-drawer \.section-heading\s*\{[^}]*align-items:\s*flex-start;/s);
});

test("review center can hide each history lane", () => {
  assert.match(reviewCenterSearchSource, /visibleReviewSections/);
  assert.doesNotMatch(reviewCenterSearchSource, /review-lane-toggles/);
  assert.match(reviewCenterSearchSource, /aria-pressed=\{visibleReviewSections\.chats\}/);
  assert.match(reviewCenterSearchSource, /aria-pressed=\{visibleReviewSections\.quizzes\}/);
  assert.match(reviewCenterSearchSource, /aria-pressed=\{visibleReviewSections\.notes\}/);
  assert.match(reviewCenterSearchSource, /aria-pressed=\{visibleReviewSections\.flashcards\}/);
  assert.match(reviewCenterSearchSource, /Show chats|Hide chats/);
  assert.match(reviewCenterSearchSource, /Show quizzes|Hide quizzes/);
  assert.match(reviewCenterSearchSource, /Show notes|Hide notes/);
  assert.match(reviewCenterSearchSource, /Show flashcards|Hide flashcards/);
  assert.match(reviewCenterSearchSource, /review-lane-body/);
  assert.match(globalsSource, /\.review-lane-header-action\s*\{/);
  assert.match(globalsSource, /\.review-lane-toggle\[aria-pressed="true"\]/);
});

test("review center mirrors the target AI review command rail", () => {
  assert.match(reviewCenterSource, /Review Nexus/);
  assert.match(reviewCenterSource, /AI review lanes/);
  assert.match(reviewCenterSource, /review-command-card/);
  assert.match(reviewCenterSource, /review-signal-chip/);
});

test("review center keeps cards aligned with the dashboard redesign language", () => {
  assert.match(globalsSource, /\.workspace-dashboard-header\s*\{/);
  assert.match(globalsSource, /\.review-signal-rail\s*\{[^}]*border-radius:\s*12px;/s);
  assert.match(globalsSource, /\.review-main-panel\s*\{[^}]*border-radius:\s*12px;/s);
  assert.match(globalsSource, /\.review-command-card\s*\{[^}]*background:\s*linear-gradient/s);
});

test("review lane markers stay in normal flow so labels cannot overlap titles", () => {
  assert.match(
    globalsSource,
    /\.review-workspace-column \.workspace-list-item\s*\{[^}]*gap:\s*0\.8rem;/s,
  );
  assert.match(globalsSource, /\.review-lane-marker\s*\{[^}]*position:\s*static;/s);
  assert.match(globalsSource, /\.review-lane-marker\s*\{[^}]*width:\s*fit-content;/s);
});
