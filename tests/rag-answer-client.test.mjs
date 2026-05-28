import assert from "node:assert/strict";
import test from "node:test";
import {
  analyzeSourcePreview,
  formatSourcePreview,
  formatSourceSimilarity,
  normalizeRagAnswerPayload,
} from "../src/lib/rag-answer-client.ts";

test("normalizeRagAnswerPayload keeps answer text and source metadata", () => {
  const result = normalizeRagAnswerPayload({
    answer: "Grounded answer.",
    chunks: [
      {
        id: "chunk-1",
        documentId: "document-1",
        documentTitle: "Algorithms Notes",
        chunkIndex: 4,
        content: "Source text",
        similarity: 0.87654,
      },
    ],
  });

  assert.deepEqual(result, {
    answer: "Grounded answer.",
    chunks: [
      {
        id: "chunk-1",
        documentId: "document-1",
        documentTitle: "Algorithms Notes",
        chunkIndex: 4,
        content: "Source text",
        similarity: 0.87654,
      },
    ],
  });
});

test("normalizeRagAnswerPayload rejects invalid API payloads", () => {
  assert.throws(
    () => normalizeRagAnswerPayload({ answer: "", chunks: "invalid" }),
    /Invalid RAG answer response/,
  );
});

test("formatSourceSimilarity renders percentage text for source cards", () => {
  assert.equal(formatSourceSimilarity(0.87654), "87.7%");
});

test("analyzeSourcePreview marks readable prose as readable and returns a cleaned preview", () => {
  const result = analyzeSourcePreview(
    [
      "Kinetic energy describes the energy of motion.",
      "",
      `It depends on mass and velocity ${"\u25A0"} ${"\u25A1"} ${"\uFFFD"} and it increases as speed rises.`,
      "",
      `-- 13 ${"\u5171"} 21 --`,
    ].join("\n"),
  );

  assert.equal(result.kind, "readable");
  assert.equal(
    result.preview,
    "Kinetic energy describes the energy of motion. It depends on mass and velocity and it increases as speed rises.",
  );
  assert.deepEqual(result.keywords, [
    "kinetic",
    "energy",
    "describes",
    "motion",
    "depends",
    "mass",
  ]);
  assert.equal(result.excerpt, "");
});

test("analyzeSourcePreview filters long digit sequences and matrix noise from low-quality excerpts while keeping semantic context", () => {
  const result = analyzeSourcePreview(
    [
      "20241234 99887766 12345678",
      "a a a a a a b b b",
      "Revenue strategy focuses on optional palindrome prefix ideas for production systems.",
      "The team discusses the longest prefix problem and explains the core idea clearly.",
      "3.1415926 2.7182818 1.6180339 0.5772156",
      "North America roadmap",
    ].join("\n"),
  );

  assert.equal(result.kind, "low_quality_preview");
  assert.equal(
    result.preview,
    "This source contains table/code-like content. Preview may lose original formatting.",
  );
  assert.deepEqual(result.keywords, [
    "revenue",
    "strategy",
    "focuses",
    "optional",
    "palindrome",
    "prefix",
  ]);
  assert.ok(result.excerpt.length >= 80);
  assert.ok(result.excerpt.length <= 150);
  assert.doesNotMatch(result.excerpt, /\d{4,}/);
  assert.doesNotMatch(result.excerpt, /\ba\b(?:\s+a\b){3,}/i);
  assert.match(result.excerpt, /optional palindrome prefix ideas/i);
});

test("analyzeSourcePreview keeps excerpt empty when low-quality content has no meaningful natural-language context after filtering", () => {
  const result = analyzeSourcePreview(
    [
      "20241234 99887766 12345678",
      "3.1415926 2.7182818 1.6180339 0.5772156",
      "a a a a a a",
      "x y z z z",
      `\u25A0 \u25AA \u25FC`,
    ].join("\n"),
  );

  assert.equal(result.kind, "low_quality_preview");
  assert.equal(
    result.preview,
    "This source contains table/code-like content. Preview may lose original formatting.",
  );
  assert.equal(result.excerpt, "");
});

test("analyzeSourcePreview removes PDF glyph residue from low-quality excerpts", () => {
  const result = analyzeSourcePreview(
    [
      "20241234 99887766 12345678",
      "a a a a a a b b b",
      `Revenue ${"\u25A0"} Total ${"\u25AA"} Margin ${"\u25FC"} ${"\uFFFD"}`,
      "",
      `\u0007 EBITDA 0011 2234`,
      "Optional idea discussion for planners and engineers remains useful context.",
    ].join("\n"),
  );

  assert.equal(result.kind, "low_quality_preview");
  assert.doesNotMatch(result.excerpt, /[■□▪▫◼◽◾◿�]/);
});

test("formatSourcePreview returns the readable preview text", () => {
  const longContent =
    "Kinetic energy describes motion and depends on mass and velocity. ".repeat(
      8,
    );

  const preview = formatSourcePreview(longContent);

  assert.equal(preview.length, 403);
  assert.equal(
    preview,
    `${longContent.replace(/\s+/g, " ").trim().slice(0, 400)}...`,
  );
});
