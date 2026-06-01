"use client";

import { useEffect, useState } from "react";

type StudyNote = {
  id: string;
  documentId: string;
  title: string | null;
  content: string;
  noteType: "ai_summary" | "manual";
  createdAt: string;
};

type StudyNotesPanelProps = {
  documentId: string;
  canGenerate: boolean;
};

function formatNoteCreatedAt(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function normalizeStudyNote(value: unknown): StudyNote {
  if (!value || typeof value !== "object") {
    throw new Error("Note response must include note data.");
  }

  const candidate = value as Record<string, unknown>;
  const noteType = candidate.noteType;

  if (noteType !== "ai_summary" && noteType !== "manual") {
    throw new Error("Note response included an invalid note type.");
  }

  return {
    id: typeof candidate.id === "string" ? candidate.id : "",
    documentId: typeof candidate.documentId === "string" ? candidate.documentId : "",
    title: typeof candidate.title === "string" ? candidate.title : null,
    content: typeof candidate.content === "string" ? candidate.content : "",
    noteType,
    createdAt: typeof candidate.createdAt === "string" ? candidate.createdAt : "",
  };
}

function normalizeStudyNoteList(value: unknown): StudyNote[] {
  if (!Array.isArray(value)) {
    throw new Error("Notes response must be a list.");
  }

  return value.map(normalizeStudyNote).filter((note) => note.id && note.content);
}

function getNoteTypeLabel(noteType: StudyNote["noteType"]) {
  return noteType === "ai_summary" ? "AI notes" : "Manual";
}

export function StudyNotesPanel({ documentId, canGenerate }: StudyNotesPanelProps) {
  const [notes, setNotes] = useState<StudyNote[]>([]);
  const [loadedNote, setLoadedNote] = useState<StudyNote | null>(null);
  const [manualTitle, setManualTitle] = useState("");
  const [manualContent, setManualContent] = useState("");
  const [error, setError] = useState("");
  const [historyError, setHistoryError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSavingManual, setIsSavingManual] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);

  async function loadNotesHistory() {
    setHistoryError("");
    setIsLoadingHistory(true);

    try {
      const response = await fetch(
        `/api/study/notes?documentId=${encodeURIComponent(documentId)}`,
      );
      const payload = await response.json();

      if (!response.ok) {
        const message =
          payload && typeof payload.error === "string"
            ? payload.error
            : "Unable to load notes history right now.";

        throw new Error(message);
      }

      setNotes(normalizeStudyNoteList(payload));
    } catch (requestError) {
      setHistoryError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load notes history right now.",
      );
    } finally {
      setIsLoadingHistory(false);
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function loadInitialNotesHistory() {
      setHistoryError("");
      setIsLoadingHistory(true);

      try {
        const response = await fetch(
          `/api/study/notes?documentId=${encodeURIComponent(documentId)}`,
        );
        const payload = await response.json();

        if (!response.ok) {
          const message =
            payload && typeof payload.error === "string"
              ? payload.error
              : "Unable to load notes history right now.";

          throw new Error(message);
        }

        if (isMounted) {
          setNotes(normalizeStudyNoteList(payload));
        }
      } catch (requestError) {
        if (isMounted) {
          setHistoryError(
            requestError instanceof Error
              ? requestError.message
              : "Unable to load notes history right now.",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoadingHistory(false);
        }
      }
    }

    loadInitialNotesHistory();

    return () => {
      isMounted = false;
    };
  }, [documentId]);

  async function handleGenerateNotes() {
    if (!canGenerate || isGenerating) {
      return;
    }

    setError("");
    setSuccessMessage("");
    setIsGenerating(true);

    try {
      const response = await fetch("/api/study/notes", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          documentId,
          mode: "ai",
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        const message =
          payload && typeof payload.error === "string"
            ? payload.error
            : "Unable to generate study notes right now.";

        throw new Error(message);
      }

      const savedNote = normalizeStudyNote(payload);
      setLoadedNote(savedNote);
      setSuccessMessage("AI notes saved.");
      await loadNotesHistory();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to generate study notes right now.",
      );
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleSaveManualNote() {
    if (isSavingManual) {
      return;
    }

    setError("");
    setSuccessMessage("");
    setIsSavingManual(true);

    try {
      const response = await fetch("/api/study/notes", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          documentId,
          title: manualTitle,
          content: manualContent,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        const message =
          payload && typeof payload.error === "string"
            ? payload.error
            : "Unable to save note right now.";

        throw new Error(message);
      }

      const savedNote = normalizeStudyNote(payload);
      setManualTitle("");
      setManualContent("");
      setLoadedNote(savedNote);
      setSuccessMessage("Note saved.");
      await loadNotesHistory();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to save note right now.",
      );
    } finally {
      setIsSavingManual(false);
    }
  }

  function loadSavedNote(note: StudyNote) {
    setError("");
    setSuccessMessage("");
    setLoadedNote((currentNote) => (currentNote?.id === note.id ? null : note));
  }

  async function deleteSavedNote(note: StudyNote) {
    if (!window.confirm("Delete this saved note?")) {
      return;
    }

    setHistoryError("");
    setSuccessMessage("");
    setDeletingNoteId(note.id);

    try {
      const response = await fetch("/api/study/notes", {
        method: "DELETE",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          noteId: note.id,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        const message =
          payload && typeof payload.error === "string"
            ? payload.error
            : "Unable to delete note right now.";

        throw new Error(message);
      }

      setNotes((currentNotes) =>
        currentNotes.filter((savedNote) => savedNote.id !== note.id),
      );
      setLoadedNote((currentNote) =>
        currentNote?.id === note.id ? null : currentNote,
      );
      setSuccessMessage("Note deleted.");
    } catch (requestError) {
      setHistoryError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to delete note right now.",
      );
    } finally {
      setDeletingNoteId(null);
    }
  }

  return (
    <section
      className="list-section parsed-text-section"
      aria-label="Study notes"
    >
      <div className="section-heading">
        <h2>Study Notes</h2>
        <p>{isLoadingHistory ? "Loading..." : `${notes.length} saved`}</p>
      </div>

      <article className="study-quiz-form">
        <p className="form-message">
          Generate AI study notes or save your own notes for this document.
        </p>

        {!canGenerate ? (
          <p className="form-message warning">
            AI notes need completed document processing and parsed text.
          </p>
        ) : null}

        {error ? <p className="form-message error">{error}</p> : null}
        {successMessage ? (
          <p className="form-message success">{successMessage}</p>
        ) : null}

        <div className="button-row">
          <button
            className="button"
            type="button"
            onClick={handleGenerateNotes}
            disabled={!canGenerate || isGenerating}
          >
            {isGenerating ? "Generating..." : "Generate AI Notes"}
          </button>
        </div>

        <label className="form-field">
          Manual note title
          <input
            type="text"
            value={manualTitle}
            onChange={(event) => setManualTitle(event.target.value)}
            placeholder="Optional title"
          />
        </label>

        <label className="form-field">
          Manual Note
          <textarea
            value={manualContent}
            onChange={(event) => setManualContent(event.target.value)}
            placeholder="Write a note for this document"
          />
        </label>

        <div className="button-row">
          <button
            className="button secondary"
            type="button"
            onClick={handleSaveManualNote}
            disabled={isSavingManual || !manualContent.trim()}
          >
            {isSavingManual ? "Saving..." : "Save Note"}
          </button>
        </div>
      </article>

      <div className="quiz-history" aria-label="Notes history">
        <div className="section-heading">
          <h3>Notes History</h3>
          <p>{isLoadingHistory ? "Loading..." : `${notes.length} saved`}</p>
        </div>

        {historyError ? <p className="form-message error">{historyError}</p> : null}

        {notes.length > 0 ? (
          <div className="list">
            {notes.map((note) => (
              <article className="quiz-history-item" key={note.id}>
                <div>
                  <h4>{note.title ?? "Untitled note"}</h4>
                  <p>
                    {formatNoteCreatedAt(note.createdAt)} -{" "}
                    {getNoteTypeLabel(note.noteType)}
                  </p>
                </div>

                <div className="quiz-history-actions">
                  <button
                    className="button secondary"
                    type="button"
                    onClick={() => loadSavedNote(note)}
                  >
                    {loadedNote?.id === note.id ? "Hide note" : "Load note"}
                  </button>
                  <button
                    className="button secondary"
                    type="button"
                    onClick={() => deleteSavedNote(note)}
                    disabled={deletingNoteId === note.id}
                  >
                    {deletingNoteId === note.id ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : !isLoadingHistory && !historyError ? (
          <article className="card chat-empty-state">
            <p>No saved notes yet.</p>
          </article>
        ) : null}
      </div>

      {loadedNote ? (
        <article className="card study-note-preview">
          <div className="quiz-question-meta">
            <h3>{loadedNote.title ?? "Untitled note"}</h3>
            <span className="quiz-question-type">
              {getNoteTypeLabel(loadedNote.noteType)}
            </span>
          </div>
          <p className="raw-text-preview">{loadedNote.content}</p>
        </article>
      ) : null}
    </section>
  );
}
