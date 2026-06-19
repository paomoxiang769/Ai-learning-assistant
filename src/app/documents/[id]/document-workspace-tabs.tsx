"use client";

import { useState, type ReactNode } from "react";

export type DocumentWorkspaceTab =
  | "overview"
  | "chat"
  | "quiz"
  | "notes"
  | "flashcards";

type DocumentWorkspaceTabsProps = {
  initialTab: DocumentWorkspaceTab;
  overviewContent: ReactNode;
  chatContent: ReactNode;
  quizContent: ReactNode;
  notesContent: ReactNode;
  flashcardsContent: ReactNode;
};

const DOCUMENT_WORKSPACE_TABS: Array<{
  id: DocumentWorkspaceTab;
  label: string;
}> = [
  { id: "overview", label: "Overview" },
  { id: "chat", label: "Chat" },
  { id: "quiz", label: "Quiz" },
  { id: "notes", label: "Notes" },
  { id: "flashcards", label: "Flashcards" },
];

export function DocumentWorkspaceTabs({
  initialTab,
  overviewContent,
  chatContent,
  quizContent,
  notesContent,
  flashcardsContent,
}: DocumentWorkspaceTabsProps) {
  const [activeTab, setActiveTab] = useState<DocumentWorkspaceTab>(initialTab);
  const panels: Record<DocumentWorkspaceTab, ReactNode> = {
    overview: overviewContent,
    chat: chatContent,
    quiz: quizContent,
    notes: notesContent,
    flashcards: flashcardsContent,
  };

  return (
    <section className="document-workspace-tabs" aria-label="Document workspace">
      <div className="document-workspace-tablist" role="tablist">
        {DOCUMENT_WORKSPACE_TABS.map((tab) => {
          const isSelected = activeTab === tab.id;

          return (
            <button
              aria-controls={`document-workspace-panel-${tab.id}`}
              aria-selected={isSelected}
              className={`document-workspace-tab${
                isSelected ? " is-active" : ""
              }`}
              id={`document-workspace-tab-${tab.id}`}
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              role="tab"
              type="button"
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {DOCUMENT_WORKSPACE_TABS.map((tab) => (
        <div
          aria-labelledby={`document-workspace-tab-${tab.id}`}
          className="document-workspace-tabpanel"
          hidden={activeTab !== tab.id}
          id={`document-workspace-panel-${tab.id}`}
          key={tab.id}
          role="tabpanel"
          tabIndex={0}
        >
          {panels[tab.id]}
        </div>
      ))}
    </section>
  );
}
