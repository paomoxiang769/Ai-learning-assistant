import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDocumentChatHistory,
  buildDocumentChatMessageInsert,
  normalizeDocumentChatMessages,
} from "../src/lib/document-chat.ts";

test("normalizeDocumentChatMessages keeps persisted assistant sources and normalizes null sources", () => {
  const messages = normalizeDocumentChatMessages([
    {
      id: "message-1",
      role: "user",
      content: "What is kinetic energy?",
      sources: null,
    },
    {
      id: "message-2",
      role: "assistant",
      content: "Kinetic energy is the energy of motion.",
      sources: [
        {
          id: "chunk-1",
          documentId: "document-1",
          chunkIndex: 0,
          content: "Kinetic energy is the energy of motion.",
          similarity: 0.91,
        },
      ],
    },
  ]);

  assert.deepEqual(messages, [
    {
      id: "message-1",
      role: "user",
      content: "What is kinetic energy?",
      sources: [],
    },
    {
      id: "message-2",
      role: "assistant",
      content: "Kinetic energy is the energy of motion.",
      sources: [
        {
          id: "chunk-1",
          documentId: "document-1",
          chunkIndex: 0,
          content: "Kinetic energy is the energy of motion.",
          similarity: 0.91,
        },
      ],
    },
  ]);
});

test("buildDocumentChatHistory returns only role and content for multi-turn RAG prompts", () => {
  const history = buildDocumentChatHistory([
    {
      id: "message-1",
      role: "user",
      content: "First turn",
      sources: [],
    },
    {
      id: "message-2",
      role: "assistant",
      content: "First answer",
      sources: [
        {
          id: "chunk-1",
          documentId: "document-1",
          chunkIndex: 0,
          content: "Grounding chunk.",
          similarity: 0.91,
        },
      ],
    },
  ]);

  assert.deepEqual(history, [
    { role: "user", content: "First turn" },
    { role: "assistant", content: "First answer" },
  ]);
});

test("buildDocumentChatMessageInsert stores assistant sources and clears user sources", () => {
  assert.deepEqual(
    buildDocumentChatMessageInsert({
      documentId: "document-1",
      userId: "user-1",
      role: "user",
      content: "Question text",
      sources: [
        {
          id: "chunk-unused",
          documentId: "document-1",
          chunkIndex: 1,
          content: "Unused source",
          similarity: 0.5,
        },
      ],
    }),
    {
      document_id: "document-1",
      user_id: "user-1",
      role: "user",
      content: "Question text",
      sources: null,
    },
  );

  assert.deepEqual(
    buildDocumentChatMessageInsert({
      documentId: "document-1",
      userId: "user-1",
      role: "assistant",
      content: "Answer text",
      sources: [
        {
          id: "chunk-1",
          documentId: "document-1",
          chunkIndex: 1,
          content: "Grounding source",
          similarity: 0.95,
        },
      ],
    }),
    {
      document_id: "document-1",
      user_id: "user-1",
      role: "assistant",
      content: "Answer text",
      sources: [
        {
          id: "chunk-1",
          documentId: "document-1",
          chunkIndex: 1,
          content: "Grounding source",
          similarity: 0.95,
        },
      ],
    },
  );
});
