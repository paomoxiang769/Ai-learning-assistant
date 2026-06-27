"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BorderGlow } from "@/components/border-glow";
import {
  buildKeywordSearchResults,
  normalizeSearchQuery,
  type SemanticSearchResult,
} from "@/lib/search";
import type { DashboardSearchData } from "@/lib/dashboard";

type DashboardGlobalSearchProps = {
  searchData: DashboardSearchData;
  placeholder: string;
};

type SemanticSearchMode = "semantic" | "keyword";

type SemanticSearchResponse = {
  mode: SemanticSearchMode;
  results: SemanticSearchResult[];
};

function getResultTypeLabel(type: SemanticSearchResult["type"]) {
  if (type === "document") {
    return "Document";
  }

  if (type === "note") {
    return "Note";
  }

  if (type === "quiz") {
    return "Quiz";
  }

  return "Flashcard";
}

function isSemanticSearchResponse(value: unknown): value is SemanticSearchResponse {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    (candidate.mode === "semantic" || candidate.mode === "keyword") &&
    Array.isArray(candidate.results)
  );
}

export function DashboardGlobalSearch({
  searchData,
  placeholder,
}: DashboardGlobalSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SemanticSearchResult[]>([]);
  const [mode, setMode] = useState<SemanticSearchMode>("semantic");
  const [isLoading, setIsLoading] = useState(false);
  const [didUseClientFallback, setDidUseClientFallback] = useState(false);
  const normalizedQuery = normalizeSearchQuery(query);
  const keywordFallbackResults = useMemo(
    () =>
      buildKeywordSearchResults({
        query,
        documents: searchData.documents,
        notes: searchData.notes,
        quizzes: searchData.quizzes,
        flashcards: searchData.flashcards,
      }),
    [query, searchData],
  );

  useEffect(() => {
    if (!normalizedQuery) {
      setResults([]);
      setMode("semantic");
      setIsLoading(false);
      setDidUseClientFallback(false);
      return;
    }

    const controller = new AbortController();

    async function runSemanticSearch() {
      setIsLoading(true);
      setDidUseClientFallback(false);

      try {
        const response = await fetch("/api/study/search", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ query }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Semantic search request failed.");
        }

        const payload = (await response.json()) as unknown;

        if (!isSemanticSearchResponse(payload)) {
          throw new Error("Semantic search response was invalid.");
        }

        setMode(payload.mode);
        setResults(payload.results);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setMode("keyword");
        setResults(keywordFallbackResults);
        setDidUseClientFallback(true);
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void runSemanticSearch();

    return () => {
      controller.abort();
    };
  }, [keywordFallbackResults, normalizedQuery, query]);

  const isKeywordFallback = mode === "keyword" || didUseClientFallback;

  return (
    <section className="list-section dashboard-section search-discovery-panel">
      <div className="section-heading">
        <div>
          <span className="panel-kicker">Semantic Search</span>
          <h2>Search & discovery</h2>
          <p>
            {normalizedQuery
              ? `${results.length} results across documents, notes, quizzes, and flashcards.`
              : "Search documents, notes, quizzes, and flashcards by concept."}
          </p>
        </div>
      </div>

      <label className="form-field search-field" htmlFor="dashboard-global-search">
        Search workspace
        <input
          id="dashboard-global-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={placeholder}
        />
      </label>

      {!normalizedQuery ? (
        <BorderGlow className="card empty-card">
          <h3>Search Results</h3>
          <p>Enter a concept, phrase, or topic to search your study workspace.</p>
        </BorderGlow>
      ) : isLoading ? (
        <BorderGlow className="card empty-card">
          <h3>Search Results</h3>
          <p>Searching by semantic relevance...</p>
        </BorderGlow>
      ) : results.length === 0 ? (
        <BorderGlow className="card empty-card">
          <h3>No matches</h3>
          <p>Try a document title, note phrase, quiz question, or flashcard answer.</p>
        </BorderGlow>
      ) : (
        <div className="search-result-card-grid">
          <BorderGlow
            className="search-result-group search-result-group-card"
            aria-label="Search Results"
          >
            <div className="search-result-group-header">
              <div>
                <span className="panel-kicker">
                  {isKeywordFallback
                    ? "Semantic search unavailable; showing keyword matches."
                    : "Semantic matches"}
                </span>
                <h3>Search Results</h3>
              </div>
              <span className="search-result-count">{results.length}</span>
            </div>

            <div className="search-result-list">
              {results.map((result) => (
                <Link
                  className="search-result-card"
                  href={result.href}
                  key={`${result.type}-${result.id}`}
                >
                  <span className="search-result-card-meta">
                    <span className="search-result-type">
                      {getResultTypeLabel(result.type)}
                    </span>
                    <span className="search-result-relevance">
                      Relevance{" "}
                      {result.relevancePercent === null
                        ? "Keyword match"
                        : `${result.relevancePercent}%`}
                    </span>
                  </span>
                  <strong>{result.title}</strong>
                  {result.excerpt ? <small>{result.excerpt}</small> : null}
                </Link>
              ))}
            </div>
          </BorderGlow>
        </div>
      )}
    </section>
  );
}
