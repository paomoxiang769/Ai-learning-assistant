import { NextResponse } from "next/server.js";
import {
  buildKeywordSearchResults,
  type SearchableDocument,
  type SearchableFlashcard,
  type SearchableNote,
  type SearchableQuiz,
  type SemanticSearchResult,
} from "./search.ts";
import { normalizeStoredStudyQuizPayload } from "./study-quiz-types.ts";

type Awaitable<T> = PromiseLike<T> | T;

type SemanticSearchMode = "semantic" | "keyword";

export type SemanticSearchResponse = {
  mode: SemanticSearchMode;
  results: SemanticSearchResult[];
};

type AuthResult = {
  data: {
    user: {
      id: string;
    } | null;
  };
};

type QueryResult<T> = {
  data: T[] | null;
  error: {
    message: string;
  } | null;
};

type RpcResult = QueryResult<RetrievedChunkRow>;

type SemanticSearchClient = {
  auth: {
    getUser(): Awaitable<AuthResult>;
  };
  from(table: string): any;
  rpc(
    fnName: "match_document_chunks",
    params: {
      query_embedding: number[];
      match_count: number;
      filter_document_id: string | null;
    },
  ): Awaitable<RpcResult>;
};

type SemanticSearchDependencies = {
  createClient(): Promise<SemanticSearchClient>;
  generateEmbedding(query: string): Promise<number[]>;
};

type SearchInput = {
  query: string;
  userId: string;
};

type DocumentRow = {
  id: string;
  file_name: string;
  created_at: string;
};

type NoteRow = {
  id: string;
  document_id: string;
  title: string | null;
  content: string;
  created_at: string;
};

type QuizRow = {
  id: string;
  document_id: string;
  title: string | null;
  quiz_json: unknown;
  created_at: string;
};

type FlashcardRow = {
  id: string;
  document_id: string;
  question: string;
  answer: string;
  created_at: string;
};

type RetrievedChunkRow = {
  id: string;
  document_id: string;
  chunk_index: number;
  content: string;
  similarity: number;
};

type SemanticDocumentHit = {
  document: DocumentRow;
  similarity: number;
  excerpt: string;
};

const SEMANTIC_MATCH_COUNT_PER_DOCUMENT = 1;

function getText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getExcerpt(value: string) {
  const normalizedValue = value.replace(/\s+/g, " ").trim();

  if (normalizedValue.length <= 120) {
    return normalizedValue;
  }

  return `${normalizedValue.slice(0, 117)}...`;
}

function getRelevancePercent(similarity: number) {
  return Math.max(0, Math.min(100, Math.round(similarity * 100)));
}

function getQuizExcerpt(row: QuizRow) {
  const firstQuestion = normalizeStoredStudyQuizPayload(row.quiz_json)[0];

  if (!firstQuestion) {
    return "Saved quiz";
  }

  return getExcerpt(
    [firstQuestion.question, firstQuestion.answer, firstQuestion.explanation]
      .filter(Boolean)
      .join(" "),
  );
}

async function loadCompletedDocuments(
  supabase: SemanticSearchClient,
  userId: string,
) {
  const { data, error } = (await supabase
    .from("documents")
    .select("id, file_name, created_at")
    .eq("user_id", userId)
    .eq("processing_status", "completed")
    .order("created_at", { ascending: false })) as QueryResult<DocumentRow>;

  if (error) {
    throw new Error(`Unable to load searchable documents: ${error.message}`);
  }

  return data ?? [];
}

async function loadKeywordDocuments(
  supabase: SemanticSearchClient,
  userId: string,
) {
  const { data, error } = (await supabase
    .from("documents")
    .select("id, file_name, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })) as QueryResult<DocumentRow>;

  if (error) {
    throw new Error(`Unable to load keyword documents: ${error.message}`);
  }

  return data ?? [];
}

async function loadDocumentTitleMap(
  supabase: SemanticSearchClient,
  userId: string,
  documentIds: string[],
) {
  const uniqueDocumentIds = [...new Set(documentIds)];

  if (uniqueDocumentIds.length === 0) {
    return new Map<string, string>();
  }

  const { data, error } = (await supabase
    .from("documents")
    .select("id, file_name")
    .eq("user_id", userId)
    .in("id", uniqueDocumentIds)) as QueryResult<{
    id: string;
    file_name: string;
  }>;

  if (error) {
    throw new Error(`Unable to load search document titles: ${error.message}`);
  }

  return new Map((data ?? []).map((document) => [document.id, document.file_name]));
}

async function loadNotes(
  supabase: SemanticSearchClient,
  userId: string,
  documentIds?: string[],
) {
  let query = supabase
    .from("document_notes")
    .select("id, document_id, title, content, created_at")
    .eq("user_id", userId);

  if (documentIds) {
    query = query.in("document_id", documentIds);
  }

  const { data, error } = (await query.order("created_at", {
    ascending: false,
  })) as QueryResult<NoteRow>;

  if (error) {
    throw new Error(`Unable to load searchable notes: ${error.message}`);
  }

  return data ?? [];
}

async function loadQuizzes(
  supabase: SemanticSearchClient,
  userId: string,
  documentIds?: string[],
) {
  let query = supabase
    .from("document_quizzes")
    .select("id, document_id, title, quiz_json, created_at")
    .eq("user_id", userId);

  if (documentIds) {
    query = query.in("document_id", documentIds);
  }

  const { data, error } = (await query.order("created_at", {
    ascending: false,
  })) as QueryResult<QuizRow>;

  if (error) {
    throw new Error(`Unable to load searchable quizzes: ${error.message}`);
  }

  return data ?? [];
}

async function loadFlashcards(
  supabase: SemanticSearchClient,
  userId: string,
  documentIds?: string[],
) {
  let query = supabase
    .from("document_flashcards")
    .select("id, document_id, question, answer, created_at")
    .eq("user_id", userId);

  if (documentIds) {
    query = query.in("document_id", documentIds);
  }

  const { data, error } = (await query.order("created_at", {
    ascending: false,
  })) as QueryResult<FlashcardRow>;

  if (error) {
    throw new Error(`Unable to load searchable flashcards: ${error.message}`);
  }

  return data ?? [];
}

function toSearchableDocuments(rows: DocumentRow[]): SearchableDocument[] {
  return rows.map((document) => ({
    id: document.id,
    fileName: document.file_name,
    href: `/documents/${document.id}`,
  }));
}

function toSearchableNotes(
  rows: NoteRow[],
  documentTitleById: Map<string, string>,
): Array<SearchableNote & { documentTitle: string }> {
  return rows.map((note) => ({
    id: note.id,
    title: note.title,
    content: note.content,
    documentTitle: documentTitleById.get(note.document_id) ?? note.document_id,
    href: `/documents/${note.document_id}?noteId=${encodeURIComponent(note.id)}`,
  }));
}

function toSearchableQuizzes(
  rows: QuizRow[],
  documentTitleById: Map<string, string>,
): SearchableQuiz[] {
  return rows.map((quiz) => ({
    id: quiz.id,
    title: quiz.title,
    documentTitle: documentTitleById.get(quiz.document_id) ?? quiz.document_id,
    quiz: normalizeStoredStudyQuizPayload(quiz.quiz_json),
    href: `/documents/${quiz.document_id}?quizId=${encodeURIComponent(quiz.id)}`,
  }));
}

function toSearchableFlashcards(
  rows: FlashcardRow[],
  documentTitleById: Map<string, string>,
): SearchableFlashcard[] {
  return rows.map((flashcard) => ({
    id: flashcard.id,
    documentId: flashcard.document_id,
    documentTitle:
      documentTitleById.get(flashcard.document_id) ?? flashcard.document_id,
    question: flashcard.question,
    answer: flashcard.answer,
    href: `/documents/${flashcard.document_id}?flashcardId=${encodeURIComponent(
      flashcard.id,
    )}`,
  }));
}

async function loadKeywordFallbackResults(
  supabase: SemanticSearchClient,
  userId: string,
  query: string,
): Promise<SemanticSearchResponse> {
  const [documents, notes, quizzes, flashcards] = await Promise.all([
    loadKeywordDocuments(supabase, userId),
    loadNotes(supabase, userId),
    loadQuizzes(supabase, userId),
    loadFlashcards(supabase, userId),
  ]);
  const documentTitleById = await loadDocumentTitleMap(
    supabase,
    userId,
    [
      ...notes.map((note) => note.document_id),
      ...quizzes.map((quiz) => quiz.document_id),
      ...flashcards.map((flashcard) => flashcard.document_id),
    ],
  );

  return {
    mode: "keyword",
    results: buildKeywordSearchResults({
      query,
      documents: toSearchableDocuments(documents),
      notes: toSearchableNotes(notes, documentTitleById),
      quizzes: toSearchableQuizzes(quizzes, documentTitleById),
      flashcards: toSearchableFlashcards(flashcards, documentTitleById),
    }),
  };
}

async function retrieveBestDocumentHits(
  supabase: SemanticSearchClient,
  documents: DocumentRow[],
  queryEmbedding: number[],
) {
  const hits = await Promise.all(
    documents.map(async (document) => {
      const { data, error } = await supabase.rpc("match_document_chunks", {
        query_embedding: queryEmbedding,
        match_count: SEMANTIC_MATCH_COUNT_PER_DOCUMENT,
        filter_document_id: document.id,
      });

      if (error) {
        throw new Error(`Document chunk retrieval failed: ${error.message}`);
      }

      const bestChunk = (data ?? [])[0];

      if (!bestChunk) {
        return null;
      }

      return {
        document,
        similarity: bestChunk.similarity,
        excerpt: getExcerpt(bestChunk.content),
      } satisfies SemanticDocumentHit;
    }),
  );

  return hits
    .filter((hit): hit is SemanticDocumentHit => hit !== null)
    .sort((left, right) => right.similarity - left.similarity);
}

function buildSemanticResults({
  hits,
  notes,
  quizzes,
  flashcards,
}: {
  hits: SemanticDocumentHit[];
  notes: NoteRow[];
  quizzes: QuizRow[];
  flashcards: FlashcardRow[];
}) {
  const results: SemanticSearchResult[] = [];

  for (const hit of hits) {
    const relevancePercent = getRelevancePercent(hit.similarity);
    const matchingNotes = notes.filter(
      (note) => note.document_id === hit.document.id,
    );
    const matchingQuizzes = quizzes.filter(
      (quiz) => quiz.document_id === hit.document.id,
    );
    const matchingFlashcards = flashcards.filter(
      (flashcard) => flashcard.document_id === hit.document.id,
    );

    results.push({
      id: hit.document.id,
      type: "document",
      title: hit.document.file_name,
      href: `/documents/${hit.document.id}`,
      similarity: hit.similarity,
      relevancePercent,
      excerpt: hit.excerpt,
    });

    for (const note of matchingNotes) {
      results.push({
        id: note.id,
        type: "note",
        title: note.title ?? hit.document.file_name,
        href: `/documents/${note.document_id}?noteId=${encodeURIComponent(note.id)}`,
        similarity: hit.similarity,
        relevancePercent,
        excerpt: getExcerpt(note.content),
      });
    }

    for (const quiz of matchingQuizzes) {
      results.push({
        id: quiz.id,
        type: "quiz",
        title: quiz.title ?? hit.document.file_name,
        href: `/documents/${quiz.document_id}?quizId=${encodeURIComponent(quiz.id)}`,
        similarity: hit.similarity,
        relevancePercent,
        excerpt: getQuizExcerpt(quiz),
      });
    }

    for (const flashcard of matchingFlashcards) {
      results.push({
        id: flashcard.id,
        type: "flashcard",
        title: flashcard.question,
        href: `/documents/${flashcard.document_id}?flashcardId=${encodeURIComponent(
          flashcard.id,
        )}`,
        similarity: hit.similarity,
        relevancePercent,
        excerpt: getExcerpt(flashcard.answer),
      });
    }
  }

  return results;
}

export function createSemanticSearchService(
  dependencies: SemanticSearchDependencies,
) {
  return async function semanticSearch({
    query,
    userId,
  }: SearchInput): Promise<SemanticSearchResponse> {
    const trimmedQuery = query.trim();
    const supabase = await dependencies.createClient();

    if (!trimmedQuery) {
      return {
        mode: "semantic",
        results: [],
      };
    }

    try {
      const queryEmbedding = await dependencies.generateEmbedding(trimmedQuery);
      const documents = await loadCompletedDocuments(supabase, userId);

      if (documents.length === 0) {
        return {
          mode: "semantic",
          results: [],
        };
      }

      const hits = await retrieveBestDocumentHits(
        supabase,
        documents,
        queryEmbedding,
      );
      const documentIds = hits.map((hit) => hit.document.id);

      if (documentIds.length === 0) {
        return {
          mode: "semantic",
          results: [],
        };
      }

      const [notes, quizzes, flashcards] = await Promise.all([
        loadNotes(supabase, userId, documentIds),
        loadQuizzes(supabase, userId, documentIds),
        loadFlashcards(supabase, userId, documentIds),
      ]);

      return {
        mode: "semantic",
        results: buildSemanticResults({
          hits,
          notes,
          quizzes,
          flashcards,
        }),
      };
    } catch {
      return await loadKeywordFallbackResults(supabase, userId, trimmedQuery);
    }
  };
}

export function createSemanticSearchRoute(
  dependencies: SemanticSearchDependencies,
) {
  async function POST(request: Request) {
    const supabase = await dependencies.createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    let body: Record<string, unknown>;

    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const query = getText(body.query);

    if (!query) {
      return NextResponse.json({
        mode: "semantic",
        results: [],
      } satisfies SemanticSearchResponse);
    }

    const search = createSemanticSearchService({
      createClient: async () => supabase,
      generateEmbedding: dependencies.generateEmbedding,
    });

    return NextResponse.json(await search({ query, userId: user.id }));
  }

  return {
    POST,
  };
}
