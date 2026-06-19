"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BorderGlow } from "@/components/border-glow";
import { buildGlobalSearchResults } from "@/lib/search";
import type { DashboardSearchData } from "@/lib/dashboard";

type DashboardGlobalSearchProps = {
  searchData: DashboardSearchData;
  placeholder: string;
};

type SearchColumnId = "documents" | "notes" | "quizzes";

const searchColumns: Array<{
  id: SearchColumnId;
  label: string;
}> = [
  { id: "documents", label: "Documents" },
  { id: "notes", label: "Notes" },
  { id: "quizzes", label: "Quizzes" },
];

function getExcerpt(value: string) {
  const normalizedValue = value.replace(/\s+/g, " ").trim();

  if (normalizedValue.length <= 120) {
    return normalizedValue;
  }

  return `${normalizedValue.slice(0, 117)}...`;
}

export function DashboardGlobalSearch({
  searchData,
  placeholder,
}: DashboardGlobalSearchProps) {
  const [query, setQuery] = useState("");
  const [hiddenColumns, setHiddenColumns] = useState<Set<SearchColumnId>>(
    () => new Set(searchColumns.map((column) => column.id)),
  );
  const [isHiddenNoticeDismissed, setIsHiddenNoticeDismissed] = useState(false);
  const results = useMemo(
    () =>
      buildGlobalSearchResults({
        query,
        documents: searchData.documents,
        notes: searchData.notes,
        quizzes: searchData.quizzes,
      }),
    [query, searchData],
  );
  const visibleColumnCount = searchColumns.length - hiddenColumns.size;
  const areAllColumnsHidden = visibleColumnCount === 0;

  function toggleColumnVisibility(columnId: SearchColumnId) {
    setIsHiddenNoticeDismissed(false);
    setHiddenColumns((currentHiddenColumns) => {
      const nextHiddenColumns = new Set(currentHiddenColumns);

      if (nextHiddenColumns.has(columnId)) {
        nextHiddenColumns.delete(columnId);
      } else {
        nextHiddenColumns.add(columnId);
      }

      return nextHiddenColumns;
    });
  }

  function hideAllColumns() {
    setIsHiddenNoticeDismissed(false);
    setHiddenColumns(new Set(searchColumns.map((column) => column.id)));
  }

  function showAllColumns() {
    setIsHiddenNoticeDismissed(false);
    setHiddenColumns(new Set());
  }

  return (
    <section className="list-section dashboard-section search-discovery-panel">
      <div className="section-heading">
        <div>
          <span className="panel-kicker">Global Search</span>
          <h2>Search & discovery</h2>
          <p>
            {results.totalCount} results across documents, notes, and quizzes.
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

      {results.totalCount > 0 ? (
        <div className="search-column-controls" aria-label="Search result columns">
          <div className="search-column-toggle-group">
            {searchColumns.map((column) => (
              <button
                aria-pressed={!hiddenColumns.has(column.id)}
                className="search-column-toggle"
                key={column.id}
                onClick={() => toggleColumnVisibility(column.id)}
                type="button"
              >
                {column.label}
              </button>
            ))}
          </div>
          <div className="search-column-actions">
            <button
              className="search-column-action"
              disabled={areAllColumnsHidden}
              onClick={hideAllColumns}
              type="button"
            >
              Hide all
            </button>
            <button
              className="search-column-action"
              disabled={hiddenColumns.size === 0}
              onClick={showAllColumns}
              type="button"
            >
              Show all
            </button>
          </div>
        </div>
      ) : null}

      {results.totalCount === 0 ? (
        <BorderGlow className="card empty-card">
          <h3>No matches</h3>
          <p>Try a document title, note phrase, quiz question, or explanation.</p>
        </BorderGlow>
      ) : areAllColumnsHidden ? (
        isHiddenNoticeDismissed ? null : (
          <div
            className="search-results-hidden-state"
            role="status"
            aria-live="polite"
          >
            <div className="search-results-hidden-copy">
              <h3>Search columns hidden</h3>
              <p>Hidden columns stay available from the controls above.</p>
              <button
                className="search-results-hidden-action"
                onClick={showAllColumns}
                type="button"
              >
                Show all columns
              </button>
            </div>
            <button
              aria-label="Dismiss hidden search columns notice"
              className="search-results-hidden-close"
              onClick={() => setIsHiddenNoticeDismissed(true)}
              type="button"
            >
              ×
            </button>
          </div>
        )
      ) : (
        <div className="search-result-card-grid">
          {!hiddenColumns.has("documents") ? (
            <BorderGlow
              className="search-result-group search-result-group-card"
              aria-label="Document search results"
            >
              <div className="search-result-group-header">
                <div>
                  <span className="panel-kicker">Sources</span>
                  <h3>Documents</h3>
                </div>
                <div className="search-result-header-actions">
                  <span className="search-result-count">{results.documents.length}</span>
                  <button
                    className="search-result-hide-button"
                    onClick={() => toggleColumnVisibility("documents")}
                    type="button"
                  >
                    Hide
                  </button>
                </div>
              </div>
              {results.documents.length > 0 ? (
                <div className="search-result-list">
                  {results.documents.map((document) => (
                    <Link
                      className="search-result-card"
                      href={document.href}
                      key={document.id}
                    >
                      <span className="search-result-type">Document</span>
                      <strong>{document.fileName}</strong>
                      <small>Open document workspace</small>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="form-message search-result-empty">No matching documents.</p>
              )}
            </BorderGlow>
          ) : null}

          {!hiddenColumns.has("notes") ? (
            <BorderGlow
              className="search-result-group search-result-group-card"
              aria-label="Note search results"
            >
              <div className="search-result-group-header">
                <div>
                  <span className="panel-kicker">Study notes</span>
                  <h3>Notes</h3>
                </div>
                <div className="search-result-header-actions">
                  <span className="search-result-count">{results.notes.length}</span>
                  <button
                    className="search-result-hide-button"
                    onClick={() => toggleColumnVisibility("notes")}
                    type="button"
                  >
                    Hide
                  </button>
                </div>
              </div>
              {results.notes.length > 0 ? (
                <div className="search-result-list">
                  {results.notes.map((note) => (
                    <Link
                      className="search-result-card"
                      href={note.href}
                      key={note.id}
                    >
                      <span className="search-result-type">
                        {note.title ?? "Untitled note"}
                      </span>
                      <strong>{note.documentTitle}</strong>
                      <small>{getExcerpt(note.content)}</small>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="form-message search-result-empty">No matching notes.</p>
              )}
            </BorderGlow>
          ) : null}

          {!hiddenColumns.has("quizzes") ? (
            <BorderGlow
              className="search-result-group search-result-group-card"
              aria-label="Quiz search results"
            >
              <div className="search-result-group-header">
                <div>
                  <span className="panel-kicker">Practice</span>
                  <h3>Quizzes</h3>
                </div>
                <div className="search-result-header-actions">
                  <span className="search-result-count">{results.quizzes.length}</span>
                  <button
                    className="search-result-hide-button"
                    onClick={() => toggleColumnVisibility("quizzes")}
                    type="button"
                  >
                    Hide
                  </button>
                </div>
              </div>
              {results.quizzes.length > 0 ? (
                <div className="search-result-list">
                  {results.quizzes.map((quiz) => (
                    <Link
                      className="search-result-card"
                      href={quiz.href}
                      key={quiz.id}
                    >
                      <span className="search-result-type">
                        {quiz.title ?? "Saved quiz"}
                      </span>
                      <strong>{quiz.documentTitle}</strong>
                      <small>{quiz.quiz[0]?.question ?? "Saved quiz"}</small>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="form-message search-result-empty">No matching quizzes.</p>
              )}
            </BorderGlow>
          ) : null}
        </div>
      )}
    </section>
  );
}
