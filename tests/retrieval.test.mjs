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
  let capturedParams;

  const retrieveRelevantChunks = createChunkRetriever({
    generateEmbedding: async () => [0.5, 0.6],
    createClient: async () => ({
      rpc: async (_fnName, params) => {
        capturedParams = params;

        return {
          data: [],
          error: null,
        };
      },
    }),
  });

  const result = await retrieveRelevantChunks("retrieval query");

  assert.deepEqual(capturedParams, {
    query_embedding: [0.5, 0.6],
    match_count: 5,
    filter_document_id: null,
  });
  assert.deepEqual(result, []);
});

test("retrieveRelevantChunks surfaces Supabase RPC failures", async () => {
  const retrieveRelevantChunks = createChunkRetriever({
    generateEmbedding: async () => [0.8],
    createClient: async () => ({
      rpc: async () => ({
        data: null,
        error: { message: "RPC failed" },
      }),
    }),
  });

  await assert.rejects(
    () => retrieveRelevantChunks("retrieval query"),
    /Document chunk retrieval failed: RPC failed/,
  );
});
