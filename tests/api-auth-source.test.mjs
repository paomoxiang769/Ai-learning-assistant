import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

const protectedApiImplementations = [
  "src/app/api/documents/upload/route.ts",
  "src/app/api/documents/[id]/download/route.ts",
  "src/lib/document-delete-route.ts",
  "src/lib/rag-answer-route.ts",
  "src/lib/study-quiz-route.ts",
  "src/lib/study-notes-route.ts",
  "src/lib/study-flashcards-route.ts",
  "src/lib/study-review-route.ts",
  "src/lib/study-plan-route.ts",
  "src/lib/semantic-search.ts",
  "src/lib/weakness-detection-route.ts",
];

test("protected API implementations reject anonymous users with 401", async () => {
  for (const relativePath of protectedApiImplementations) {
    const source = await readFile(path.join(root, relativePath), "utf8");

    assert.match(
      source,
      /auth\.getUser\(\)/,
      `${relativePath} should verify the Supabase user`,
    );
    assert.match(
      source,
      /status:\s*401/,
      `${relativePath} should return HTTP 401 for anonymous users`,
    );
  }
});
