"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { filterDocumentsForSearch } from "@/lib/search";
import { DeleteDocumentForm } from "./delete-document-form";

export type DocumentsSearchItem = {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  createdAt: string;
  href: string;
};

type DocumentsSearchListProps = {
  documents: DocumentsSearchItem[];
};

function formatFileSize(size: number) {
  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatUploadDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function DocumentsSearchList({ documents }: DocumentsSearchListProps) {
  const [documentSearchQuery, setDocumentSearchQuery] = useState("");
  const filteredDocuments = useMemo(
    () => filterDocumentsForSearch(documents, documentSearchQuery),
    [documentSearchQuery, documents],
  );

  return (
    <>
      <label className="form-field search-field" htmlFor="documents-search">
        Search documents
        <input
          id="documents-search"
          type="search"
          value={documentSearchQuery}
          onChange={(event) => setDocumentSearchQuery(event.target.value)}
          placeholder="Search document titles"
        />
      </label>

      {filteredDocuments.length === 0 ? (
        <article className="card empty-card">
          <h2>No matching documents</h2>
          <p>Try another document title.</p>
        </article>
      ) : (
        <div className="list source-shelf-grid">
          {filteredDocuments.map((document) => (
            <article
              className="list-item workspace-list-item source-file-card"
              key={document.id}
            >
              <span className="source-lane-marker">{document.fileType}</span>
              <div>
                <span className="panel-kicker">{document.fileType}</span>
                <h2>{document.fileName}</h2>
                <p>
                  {formatFileSize(document.fileSize)} - Uploaded{" "}
                  {formatUploadDate(document.createdAt)}
                </p>
              </div>
              <div className="list-item-actions">
                <Link className="button secondary" href={document.href}>
                  View
                </Link>
                <DeleteDocumentForm
                  documentId={document.id}
                  fileName={document.fileName}
                />
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
