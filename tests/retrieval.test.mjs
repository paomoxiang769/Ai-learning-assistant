import assert from "node:assert/strict";
import test from "node:test";
import { createChunkRetriever } from "../src/lib/retrieval.ts";

test("retrieveRelevantChunks generates a query embedding and fetches matching chunks", async () => {
  const calls = [];

  const retrieveRelevantChunks = createChunkRetriever({
    generateEmbedding: async (query) => {
      calls.push(["generateEmbedding", query]);
      return [0.11, 0.22, 0.33];
    },
    createClient: async () => ({
      auth: {
        async getUser() {
          throw new Error("auth.getUser should not be called in single-document mode");
        },
      },
      from() {
        throw new Error("from() should not be called in single-document mode");
      },
      rpc: async (fnName, params) => {
        calls.push(["rpc", fnName, params]);

        return {
          data: [
            {
              id: "chunk-2",
              document_id: "document-1",
              chunk_index: 2,
              content: "Most relevant chunk",
              similarity: 0.91,
            },
            {
              id: "chunk-0",
              document_id: "document-1",
              chunk_index: 0,
              content: "Second relevant chunk",
              similarity: 0.72,
            },
          ],
          error: null,
        };
      },
    }),
  });

  const result = await retrieveRelevantChunks("retrieval query", "document-1", 2);

  assert.deepEqual(calls, [
    ["generateEmbedding", "retrieval query"],
    [
      "rpc",
      "match_document_chunks",
      {
        query_embedding: [0.11, 0.22, 0.33],
        match_count: 2,
        filter_document_id: "document-1",
      },
    ],
  ]);
  assert.deepEqual(result, [
    {
      id: "chunk-2",
      documentId: "document-1",
      chunkIndex: 2,
      content: "Most relevant chunk",
      similarity: 0.91,
    },
    {
      id: "chunk-0",
      documentId: "document-1",
      chunkIndex: 0,
      content: "Second relevant chunk",
      similarity: 0.72,
    },
  ]);
});

test("retrieveRelevantChunks uses default topK and omits document filtering when not provided", async () => {
  const calls = [];

  const retrieveRelevantChunks = createChunkRetriever({
    generateEmbedding: async (query) => {
      calls.push(["generateEmbedding", query]);
      return [0.5, 0.6];
    },
    createClient: async () => ({
      auth: {
        async getUser() {
          calls.push(["auth.getUser"]);
          return {
            data: {
              user: { id: "user-1" },
            },
          };
        },
      },
      from(table) {
        assert.equal(table, "documents");

        return {
          select(columns) {
            calls.push(["documents.select", columns]);
            return this;
          },
          eq(column, value) {
            calls.push(["documents.eq", column, value]);
            return this;
          },
          order(column, options) {
            calls.push(["documents.order", column, options]);
            return this;
          },
          then(resolve) {
            resolve({
              data: [
                {
                  id: "document-1",
                  file_name: "Algorithms Notes",
                },
                {
                  id: "document-2",
                  file_name: "String Matching Slides",
                },
              ],
              error: null,
            });
          },
        };
      },
      rpc: async (_fnName, params) => {
        calls.push(["rpc", params]);

        if (params.filter_document_id === "document-1") {
          return {
            data: [
              {
                id: "chunk-1",
                document_id: "document-1",
                chunk_index: 1,
                content: "KMP uses prefix information.",
                similarity: 0.81,
              },
            ],
            error: null,
          };
        }

        return {
          data: [
            {
              id: "chunk-8",
              document_id: "document-2",
              chunk_index: 8,
              content: "Rabin-Karp uses hashing.",
              similarity: 0.93,
            },
          ],
          error: null,
        };
      },
    }),
  });

  const result = await retrieveRelevantChunks("retrieval query");

  assert.deepEqual(calls, [
    ["generateEmbedding", "retrieval query"],
    ["auth.getUser"],
    ["documents.select", "id, file_name"],
    ["documents.eq", "user_id", "user-1"],
    ["documents.eq", "processing_status", "completed"],
    ["documents.order", "created_at", { ascending: false }],
    [
      "rpc",
      {
        query_embedding: [0.5, 0.6],
        match_count: 5,
        filter_document_id: "document-1",
      },
    ],
    [
      "rpc",
      {
        query_embedding: [0.5, 0.6],
        match_count: 5,
        filter_document_id: "document-2",
      },
    ],
  ]);
  assert.deepEqual(result, [
    {
      id: "chunk-8",
      documentId: "document-2",
      documentTitle: "String Matching Slides",
      chunkIndex: 8,
      content: "Rabin-Karp uses hashing.",
      similarity: 0.93,
    },
    {
      id: "chunk-1",
      documentId: "document-1",
      documentTitle: "Algorithms Notes",
      chunkIndex: 1,
      content: "KMP uses prefix information.",
      similarity: 0.81,
    },
  ]);
});

test("retrieveRelevantChunks returns an empty list when knowledge-base mode has no completed documents", async () => {
  const calls = [];

  const retrieveRelevantChunks = createChunkRetriever({
    generateEmbedding: async () => [0.1, 0.2],
    createClient: async () => ({
      auth: {
        async getUser() {
          calls.push(["auth.getUser"]);
          return {
            data: {
              user: { id: "user-1" },
            },
          };
        },
      },
      from() {
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          order() {
            return this;
          },
          then(resolve) {
            resolve({
              data: [],
              error: null,
            });
          },
        };
      },
      rpc: async () => {
        calls.push(["rpc"]);
        throw new Error("rpc should not be called when no documents exist");
      },
    }),
  });

  const result = await retrieveRelevantChunks("retrieval query");

  assert.deepEqual(result, []);
  assert.deepEqual(calls, [["auth.getUser"]]);
});

test("retrieveRelevantChunks surfaces Supabase RPC failures", async () => {
  const retrieveRelevantChunks = createChunkRetriever({
    generateEmbedding: async () => [0.8],
    createClient: async () => ({
      auth: {
        async getUser() {
          throw new Error("auth.getUser should not be called in single-document mode");
        },
      },
      from() {
        throw new Error("from() should not be called in single-document mode");
      },
      rpc: async () => ({
        data: null,
        error: { message: "RPC failed" },
      }),
    }),
  });

  await assert.rejects(
    () => retrieveRelevantChunks("retrieval query", "document-1"),
    /Document chunk retrieval failed: RPC failed/,
  );
});
