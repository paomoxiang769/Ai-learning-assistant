type RetrievedChunkRow = {
  id: string;
  document_id: string;
  chunk_index: number;
  content: string;
  similarity: number;
};

type RetrievedChunk = {
  id: string;
  documentId: string;
  chunkIndex: number;
  content: string;
  similarity: number;
};

type SupabaseRpcResult = {
  data: RetrievedChunkRow[] | null;
  error: {
    message: string;
  } | null;
};

type Awaitable<T> = PromiseLike<T> | T;

type RetrievalClient = {
  rpc(
    fnName: "match_document_chunks",
    params: {
      query_embedding: number[];
      match_count: number;
      filter_document_id: string | null;
    },
  ): Awaitable<SupabaseRpcResult>;
};

type RetrievalDependencies = {
  generateEmbedding(query: string): Promise<number[]>;
  createClient(): Promise<RetrievalClient>;
};

const DEFAULT_TOP_K = 5;

function normalizeTopK(topK: number | undefined) {
  if (!Number.isFinite(topK)) {
    return DEFAULT_TOP_K;
  }

  return Math.max(1, Math.floor(topK as number));
}

function mapRetrievedChunk(row: RetrievedChunkRow): RetrievedChunk {
  return {
    id: row.id,
    documentId: row.document_id,
    chunkIndex: row.chunk_index,
    content: row.content,
    similarity: row.similarity,
  };
}

export function createChunkRetriever(dependencies: RetrievalDependencies) {
  return async function retrieveRelevantChunks(
    query: string,
    documentId?: string,
    topK?: number,
  ): Promise<RetrievedChunk[]> {
    const queryEmbedding = await dependencies.generateEmbedding(query);
    const supabase = await dependencies.createClient();
    const { data, error } = await supabase.rpc("match_document_chunks", {
      query_embedding: queryEmbedding,
      match_count: normalizeTopK(topK),
      filter_document_id: documentId ?? null,
    });

    if (error) {
      throw new Error(`Document chunk retrieval failed: ${error.message}`);
    }

    return (data ?? []).map(mapRetrievedChunk);
  };
}

export const retrieveRelevantChunks = createChunkRetriever({
  async generateEmbedding(query) {
    const { generateEmbedding } = await import("./embedding.ts");

    return await generateEmbedding(query);
  },
  async createClient() {
    const { createClient } = await import("./supabase/server.ts");

    return await createClient();
  },
});

export type { RetrievedChunk };
