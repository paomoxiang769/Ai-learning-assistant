import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

const protectedPages = [
  "src/app/dashboard/page.tsx",
  "src/app/documents/page.tsx",
  "src/app/documents/[id]/page.tsx",
  "src/app/chat/page.tsx",
  "src/app/review/page.tsx",
  "src/app/quiz/[id]/page.tsx",
];

test("protected server pages redirect anonymous users to login", async () => {
  for (const relativePath of protectedPages) {
    const source = await readFile(path.join(root, relativePath), "utf8");

    assert.match(
      source,
      /from "next\/navigation"/,
      `${relativePath} should use Next navigation redirects`,
    );
    assert.match(
      source,
      /supabase\.auth\.getUser\(\)/,
      `${relativePath} should verify the current Supabase user`,
    );
    assert.match(
      source,
      /redirect\(["']\/login["']\)/,
      `${relativePath} should redirect anonymous users to /login`,
    );
  }
});
