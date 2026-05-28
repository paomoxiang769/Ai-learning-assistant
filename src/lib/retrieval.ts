type RetrievedChunkRow = {
  id: string;
  document_id: string;
  chunk_index: number;
  content: string;
  similarity: number;
};

type KnowledgeBaseDocumentRow = {
  id: string;
  file_name: string;
};

type RetrievedChunk = {
  id: string;
  documentId: string;
  documentTitle?: string;
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

type RetrievalAuthResult = {
  data: {
    user: {
      id: string;
    } | null;
  };
};

type KnowledgeBaseDocumentQueryResult = {
  data: KnowledgeBaseDocumentRow[] | null;
  error: {
    message: string;
  } | null;
};

type RetrievalClient = {
  auth: {
    getUser(): Awaitable<RetrievalAuthResult>;
  };
  from(table: "documents"): {
    select(columns: "id, file_name"): any;
  };
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

function attachDocumentTitle(
  chunk: RetrievedChunk,
  documentsById: Map<string, string>,
) {
  const documentTitle = documentsById.get(chunk.documentId);

  if (!documentTitle) {
    return chunk;
  }

  return {
    ...chunk,
    documentTitle,
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
    const normalizedTopK = normalizeTopK(topK);

    if (!documentId) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return [];
      }

      const documentsQuery = (await supabase
        .from("documents")
        .select("id, file_name")
        .eq("user_id", user.id)
        .eq("processing_status", "completed")
        .order("created_at", { ascending: false })) as KnowledgeBaseDocumentQueryResult;

      if (documentsQuery.error) {
        throw new Error(
          `Knowledge base document lookup failed: ${documentsQuery.error.message}`,
        );
      }

      const knowledgeBaseDocuments = documentsQuery.data ?? [];

      if (knowledgeBaseDocuments.length === 0) {
        return [];
      }

      const documentsById = new Map(
        knowledgeBaseDocuments.map((document) => [document.id, document.file_name]),
      );
      const chunkResults = await Promise.all(
        knowledgeBaseDocuments.map(async (document) => {
          const { data, error } = await supabase.rpc("match_document_chunks", {
            query_embedding: queryEmbedding,
            match_count: normalizedTopK,
            filter_document_id: document.id,
          });

          if (error) {
            throw new Error(`Document chunk retrieval failed: ${error.message}`);
          }

          return (data ?? [])
            .map(mapRetrievedChunk)
            .map((chunk) => attachDocumentTitle(chunk, documentsById));
        }),
      );

      return chunkResults
        .flat()
        .sort((leftChunk, rightChunk) => rightChunk.similarity - leftChunk.similarity)
        .slice(0, normalizedTopK);
    }

    const { data, error } = await supabase.rpc("match_document_chunks", {
      query_embedding: queryEmbedding,
      match_count: normalizedTopK,
      filter_document_id: documentId,
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
