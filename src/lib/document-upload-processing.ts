type PersistenceError = {
  message: string;
};

type ProcessedDocumentCheck = {
  processing_status: string | null;
  raw_text: string | null;
  summary: string | null;
};

type SaveDocumentResult = {
  error: PersistenceError | null;
};

type MarkFailedResult = {
  error: PersistenceError | null;
};

type VerifyDocumentResult = {
  data: ProcessedDocumentCheck | null;
  error: PersistenceError | null;
};

type InsertChunksResult = {
  error: PersistenceError | null;
};

type UpdateChunkEmbeddingResult = {
  error: PersistenceError | null;
};

type DocumentUploadPersistence = {
  saveDocument(update: {
    raw_text: string;
    summary: string | null;
    processing_status: "completed";
  }): Promise<SaveDocumentResult>;
  markFailed(): Promise<MarkFailedResult>;
  verifyDocument(): Promise<VerifyDocumentResult>;
  insertChunks(
    chunks: Array<{
      id: string;
      document_id: string;
      chunk_index: number;
      content: string;
    }>,
  ): Promise<InsertChunksResult>;
  updateChunkEmbedding(update: {
    id: string;
    embedding: string;
  }): Promise<UpdateChunkEmbeddingResult>;
};

type PersistProcessedDocumentParams = {
  documentId: string;
  rawText: string;
  summary: string | null;
  chunks: string[];
  generateChunkEmbedding?: (content: string) => Promise<number[]>;
  persistence: DocumentUploadPersistence;
};

function formatEmbeddingValue(embedding: number[]) {
  return `[${embedding.join(",")}]`;
}

function logEmbeddingFailure(
  message: string,
  details: {
    document_id: string;
    chunk_index: number;
    error: string;
  },
) {
  console.error(message, details);
}

export async function persistProcessedDocument({
  documentId,
  rawText,
  summary,
  chunks,
  generateChunkEmbedding,
  persistence,
}: PersistProcessedDocumentParams) {
  const { error: updateError } = await persistence.saveDocument({
    raw_text: rawText,
    summary,
    processing_status: "completed",
  });

  if (updateError) {
    const { error: failedStatusError } = await persistence.markFailed();

    return {
      error: failedStatusError
        ? `Document uploaded, but extracted text could not be saved: ${updateError.message}. Failed to mark document as failed: ${failedStatusError.message}`
        : `Document uploaded, but extracted text could not be saved: ${updateError.message}`,
      warning: null,
    };
  }

  const { data: processedDocument, error: processedDocumentError } =
    await persistence.verifyDocument();

  if (processedDocumentError) {
    return {
      error: `Document update verification failed: ${processedDocumentError.message}`,
      warning: null,
    };
  }

  const persistedRawTextLength = processedDocument?.raw_text?.length ?? 0;
  const persistedSummary = processedDocument?.summary ?? null;
  const summaryDidNotPersist =
    summary !== null && persistedSummary !== summary;

  if (
    processedDocument?.processing_status !== "completed" ||
    persistedRawTextLength !== rawText.length ||
    summaryDidNotPersist
  ) {
    return {
      error: `Document update did not persist. Expected processing_status=completed, raw_text length=${rawText.length}${summary === null ? "" : ", and generated summary"}, but read back processing_status=${processedDocument?.processing_status ?? "missing"}, raw_text length=${persistedRawTextLength}, and summary ${persistedSummary === null ? "missing" : "present"}. Check the Supabase RLS UPDATE policy for public.documents.`,
      warning: null,
    };
  }

  if (chunks.length === 0) {
    return {
      error: null,
      warning: null,
    };
  }

  const chunkRows = chunks.map((content, chunkIndex) => ({
    id: crypto.randomUUID(),
    document_id: documentId,
    chunk_index: chunkIndex,
    content,
  }));
  const { error: chunkInsertError } = await persistence.insertChunks(chunkRows);

  if (chunkInsertError) {
    return {
      error: null,
      warning: `Document chunks could not be saved: ${chunkInsertError.message}`,
    };
  }

  if (!generateChunkEmbedding) {
    return {
      error: null,
      warning: null,
    };
  }

  const embeddingWarnings: string[] = [];

  for (const chunkRow of chunkRows) {
    try {
      const embedding = await generateChunkEmbedding(chunkRow.content);
      const { error: chunkEmbeddingUpdateError } =
        await persistence.updateChunkEmbedding({
          id: chunkRow.id,
          embedding: formatEmbeddingValue(embedding),
        });

      if (chunkEmbeddingUpdateError) {
        logEmbeddingFailure("Embedding update failed", {
          document_id: documentId,
          chunk_index: chunkRow.chunk_index,
          error: chunkEmbeddingUpdateError.message,
        });
        embeddingWarnings.push(
          `chunk ${chunkRow.chunk_index}: ${chunkEmbeddingUpdateError.message}`,
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logEmbeddingFailure("Embedding generation failed", {
        document_id: documentId,
        chunk_index: chunkRow.chunk_index,
        error: message,
      });
      embeddingWarnings.push(`chunk ${chunkRow.chunk_index}: ${message}`);
    }
  }

  if (embeddingWarnings.length > 0) {
    return {
      error: null,
      warning: `Document chunk embeddings could not be saved: ${embeddingWarnings.join("; ")}`,
    };
  }

  return {
    error: null,
    warning: null,
  };
}
