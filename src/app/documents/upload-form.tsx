"use client";

import { useState, type FormEvent } from "react";

type UploadFormProps = {
  error?: string;
  message?: string;
};

export function UploadForm({ error, message }: UploadFormProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [clientError, setClientError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setClientError("");
    setIsUploading(true);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const file = formData.get("document");

    if (!(file instanceof File) || file.size === 0) {
      setClientError("Please choose a PDF or TXT file to upload.");
      setIsUploading(false);
      return;
    }

    const response = await fetch("/api/documents/upload", {
      method: "POST",
      body: formData,
    });

    window.location.href = response.url || "/documents";
  }

  return (
    <form className="upload-form" onSubmit={handleSubmit}>
      <label className="form-field" htmlFor="document">
        <span>Upload a PDF or TXT file</span>
        <input
          id="document"
          name="document"
          type="file"
          accept=".pdf,.txt,application/pdf,text/plain"
          required
        />
      </label>

      {clientError ? <p className="form-message error">{clientError}</p> : null}
      {error ? <p className="form-message error">{error}</p> : null}
      {message ? <p className="form-message success">{message}</p> : null}

      <div className="button-row">
        <button className="button" type="submit" disabled={isUploading}>
          {isUploading ? "Uploading..." : "Upload document"}
        </button>
      </div>
    </form>
  );
}
