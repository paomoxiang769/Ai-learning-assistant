import assert from "node:assert/strict";
import test from "node:test";
import { splitText } from "../src/lib/text-chunker.ts";

test("splitText returns an empty array for empty text", () => {
  assert.deepEqual(splitText(""), []);
  assert.deepEqual(splitText("   \n\t  "), []);
});

test("splitText keeps paragraph order and groups short paragraphs together", () => {
  const text = [
    "Paragraph one introduces the topic.",
    "Paragraph two adds supporting detail.",
    "Paragraph three closes the section.",
  ].join("\n\n");

  const chunks = splitText(text);

  assert.equal(chunks.length, 1);
  assert.equal(chunks[0], text);
});

test("splitText creates multiple ordered chunks for long paragraph-based text", () => {
  const paragraphA = "A".repeat(420);
  const paragraphB = "B".repeat(420);
  const paragraphC = "C".repeat(420);
  const paragraphD = "D".repeat(420);
  const text = [paragraphA, paragraphB, paragraphC, paragraphD].join("\n\n");

  const chunks = splitText(text);

  assert.deepEqual(chunks, [
    [paragraphA, paragraphB].join("\n\n"),
    [paragraphC, paragraphD].join("\n\n"),
  ]);
  assert.ok(chunks.every((chunk) => chunk.length >= 800 && chunk.length <= 1200));
});

test("splitText breaks oversized paragraphs while preserving content order", () => {
  const longParagraph = "0123456789".repeat(135);

  const chunks = splitText(longParagraph);

  assert.ok(chunks.length >= 2);
  assert.equal(chunks.join(""), longParagraph);
  assert.ok(chunks.slice(0, -1).every((chunk) => chunk.length >= 800 && chunk.length <= 1200));
  assert.ok(chunks.every((chunk) => chunk.length > 0));
});
