import assert from "node:assert/strict";
import test from "node:test";
import { persistProcessedDocument } from "../src/lib/document-upload-processing.ts";

const originalConsoleError = console.error;

test.afterEach(() => {
  console.error = originalConsoleError;
});

test("persistProcessedDocument keeps the document completed when chunk insert fails", async () => {
  const calls = [];

  const result = await persistProcessedDocument({
    documentId: "document-1",
    userId: "user-1",
    rawText: "Parsed document text",
    summary: "Generated summary",
    chunks: ["chunk one", "chunk two"],
    persistence: {
      async saveDocument(update) {
        calls.push(["saveDocument", update]);
        return { error: null };
      },
      async markFailed() {
        calls.push(["markFailed"]);
        return { error: null };
      },
      async verifyDocument() {
        calls.push(["verifyDocument"]);
        return {
          data: {
            processing_status: "completed",
            raw_text: "Parsed document text",
            summary: "Generated summary",
          },
          error: null,
        };
      },
      async insertChunks(chunks) {
        calls.push(["insertChunks", chunks]);
        return {
          error: {
            message:
              'new row violates row-level security policy for table "document_chunks"',
          },
        };
      },
      async updateChunkEmbedding(update) {
        calls.push(["updateChunkEmbedding", update]);
        return { error: null };
      },
    },
  });

  assert.deepEqual(
    calls.map(([name]) => name),
    ["saveDocument", "verifyDocument", "insertChunks"],
  );
  assert.equal(result.error, null);
  assert.match(result.warning ?? "", /Document chunks could not be saved/);
  assert.equal(calls.some(([name]) => name === "markFailed"), false);
});

test("persistProcessedDocument keeps the document completed when embedding generation fails", async () => {
  const calls = [];
  const logs = [];
  console.error = (...args) => {
    logs.push(args);
  };

  const result = await persistProcessedDocument({
    documentId: "document-1",
    rawText: "Parsed document text",
    summary: "Generated summary",
    chunks: ["chunk zero", "chunk one", "chunk two"],
    generateChunkEmbedding: async (content) => {
      calls.push(["generateChunkEmbedding", content]);

      if (content === "chunk one") {
        throw new Error("Embedding API unavailable");
      }

      return [0.1, 0.2];
    },
    persistence: {
      async saveDocument(update) {
        calls.push(["saveDocument", update]);
        return { error: null };
      },
      async markFailed() {
        calls.push(["markFailed"]);
        return { error: null };
      },
      async verifyDocument() {
        calls.push(["verifyDocument"]);
        return {
          data: {
            processing_status: "completed",
            raw_text: "Parsed document text",
            summary: "Generated summary",
          },
          error: null,
        };
      },
      async insertChunks(chunks) {
        calls.push(["insertChunks", chunks]);
        return { error: null };
      },
      async updateChunkEmbedding(update) {
        calls.push(["updateChunkEmbedding", update]);
        return { error: null };
      },
    },
  });

  assert.deepEqual(
    calls.map(([name]) => name),
    [
      "saveDocument",
      "verifyDocument",
      "insertChunks",
      "generateChunkEmbedding",
      "updateChunkEmbedding",
      "generateChunkEmbedding",
      "generateChunkEmbedding",
      "updateChunkEmbedding",
    ],
  );
  assert.equal(result.error, null);
  assert.match(result.warning ?? "", /Document chunk embeddings could not be saved/);
  assert.equal(
    calls.filter(([name]) => name === "updateChunkEmbedding").length,
    2,
  );
  assert.equal(calls.some(([name]) => name === "markFailed"), false);
  assert.deepEqual(logs, [
    [
      "Embedding generation failed",
      {
        document_id: "document-1",
        chunk_index: 1,
        error: "Embedding API unavailable",
      },
    ],
  ]);
});

test("persistProcessedDocument logs update failures and continues embedding later chunks", async () => {
  const calls = [];
  const logs = [];
  console.error = (...args) => {
    logs.push(args);
  };

  const result = await persistProcessedDocument({
    documentId: "document-2",
    rawText: "Parsed document text",
    summary: "Generated summary",
    chunks: ["chunk zero", "chunk one"],
    generateChunkEmbedding: async (content) => {
      calls.push(["generateChunkEmbedding", content]);
      return [0.1, 0.2];
    },
    persistence: {
      async saveDocument(update) {
        calls.push(["saveDocument", update]);
        return { error: null };
      },
      async markFailed() {
        calls.push(["markFailed"]);
        return { error: null };
      },
      async verifyDocument() {
        calls.push(["verifyDocument"]);
        return {
          data: {
            processing_status: "completed",
            raw_text: "Parsed document text",
            summary: "Generated summary",
          },
          error: null,
        };
      },
      async insertChunks(chunks) {
        calls.push(["insertChunks", chunks]);
        return { error: null };
      },
      async updateChunkEmbedding(update) {
        calls.push(["updateChunkEmbedding", update]);

        if (calls.filter(([name]) => name === "updateChunkEmbedding").length === 1) {
          return { error: { message: "RLS update blocked" } };
        }

        return { error: null };
      },
    },
  });

  assert.equal(result.error, null);
  assert.match(result.warning ?? "", /RLS update blocked/);
  assert.equal(
    calls.filter(([name]) => name === "generateChunkEmbedding").length,
    2,
  );
  assert.equal(
    calls.filter(([name]) => name === "updateChunkEmbedding").length,
    2,
  );
  assert.deepEqual(logs, [
    [
      "Embedding update failed",
      {
        document_id: "document-2",
        chunk_index: 0,
        error: "RLS update blocked",
      },
    ],
  ]);
});
