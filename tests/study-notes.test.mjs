import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_STUDY_NOTES_MODEL,
  generateStudyNotes,
} from "../src/lib/study-notes.ts";
import { createStudyNotesRoute } from "../src/lib/study-notes-route.ts";

const sampleGeneratedNotes = [
  "Study Notes",
  "",
  "## Key concepts",
  "- Binary search halves the search space.",
  "",
  "## Important definitions",
  "- Sorted array: an array ordered by value.",
  "",
  "## Short bullet summary",
  "- Compare the target with the middle element.",
].join("\n");

const sampleSavedNote = {
  id: "note-1",
  document_id: "document-9",
  title: "Study Notes",
  content: sampleGeneratedNotes,
  note_type: "ai_summary",
  created_at: "2026-06-01T06:00:00.000Z",
};

const originalFetch = globalThis.fetch;
const originalOpenAiApiKey = process.env.OPENAI_API_KEY;
const originalOpenAiBaseUrl = process.env.OPENAI_BASE_URL;
const originalOpenAiModel = process.env.OPENAI_MODEL;
const originalHttpsProxy = process.env.HTTPS_PROXY;
const originalHttpProxy = process.env.HTTP_PROXY;

function restoreEnvironment() {
  globalThis.fetch = originalFetch;

  if (originalOpenAiApiKey === undefined) {
    delete process.env.OPENAI_API_KEY;
  } else {
    process.env.OPENAI_API_KEY = originalOpenAiApiKey;
  }

  if (originalOpenAiBaseUrl === undefined) {
    delete process.env.OPENAI_BASE_URL;
  } else {
    process.env.OPENAI_BASE_URL = originalOpenAiBaseUrl;
  }

  if (originalOpenAiModel === undefined) {
    delete process.env.OPENAI_MODEL;
  } else {
    process.env.OPENAI_MODEL = originalOpenAiModel;
  }

  if (originalHttpsProxy === undefined) {
    delete process.env.HTTPS_PROXY;
  } else {
    process.env.HTTPS_PROXY = originalHttpsProxy;
  }

  if (originalHttpProxy === undefined) {
    delete process.env.HTTP_PROXY;
  } else {
    process.env.HTTP_PROXY = originalHttpProxy;
  }
}

test.afterEach(() => {
  restoreEnvironment();
});

test("generateStudyNotes sends raw text and summary to the configured OpenAI-compatible API", async () => {
  process.env.OPENAI_API_KEY = "test-api-key";
  process.env.OPENAI_BASE_URL = "https://compatible.example/v1";
  process.env.OPENAI_MODEL = "test-notes-model";
  delete process.env.HTTPS_PROXY;
  delete process.env.HTTP_PROXY;

  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(String(init?.body));
    const requestUrl =
      typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;

    assert.equal(requestUrl, "https://compatible.example/v1/chat/completions");
    assert.equal(init?.method, "POST");
    assert.equal(body.model, "test-notes-model");
    assert.match(body.messages[0].content, /study notes/i);
    assert.match(body.messages.at(-1).content, /Document title: Algorithms Notes/);
    assert.match(body.messages.at(-1).content, /Existing summary:/);
    assert.match(body.messages.at(-1).content, /Binary search is a search algorithm/);
    assert.match(body.messages.at(-1).content, /Raw document text:/);
    assert.match(body.messages.at(-1).content, /Binary search halves the search space/);
    assert.match(body.messages.at(-1).content, /Key concepts/);
    assert.match(body.messages.at(-1).content, /Important definitions/);
    assert.match(body.messages.at(-1).content, /Short bullet summary/);

    return new Response(
      JSON.stringify({
        id: "chatcmpl-test",
        object: "chat.completion",
        created: 0,
        model: "test-notes-model",
        choices: [
          {
            index: 0,
            finish_reason: "stop",
            message: {
              role: "assistant",
              content: sampleGeneratedNotes,
            },
          },
        ],
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    );
  };

  const notes = await generateStudyNotes("Binary search halves the search space.", {
    documentTitle: "Algorithms Notes",
    summary: "Binary search is a search algorithm.",
  });

  assert.equal(notes, sampleGeneratedNotes);
});

test("generateStudyNotes defaults OPENAI_MODEL to the study notes default", async () => {
  process.env.OPENAI_API_KEY = "test-api-key";
  process.env.OPENAI_BASE_URL = "https://compatible.example/v1";
  delete process.env.OPENAI_MODEL;
  delete process.env.HTTPS_PROXY;
  delete process.env.HTTP_PROXY;

  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body));

    assert.equal(body.model, DEFAULT_STUDY_NOTES_MODEL);

    return new Response(
      JSON.stringify({
        id: "chatcmpl-test",
        object: "chat.completion",
        created: 0,
        model: DEFAULT_STUDY_NOTES_MODEL,
        choices: [
          {
            index: 0,
            finish_reason: "stop",
            message: { role: "assistant", content: sampleGeneratedNotes },
          },
        ],
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    );
  };

  const notes = await generateStudyNotes("Binary search notes.");

  assert.equal(notes, sampleGeneratedNotes);
});

test("generateStudyNotes rejects empty raw text", async () => {
  process.env.OPENAI_API_KEY = "test-api-key";

  await assert.rejects(
    () => generateStudyNotes("  \n\t  "),
    /Cannot generate study notes for empty document text/,
  );
});

test("study notes POST saves a manual note for an owned document", async () => {
  const operations = [];
  const { POST } = createStudyNotesRoute({
    createClient: async () => ({
      auth: {
        async getUser() {
          return {
            data: {
              user: { id: "user-1" },
            },
          };
        },
      },
      from(table) {
        operations.push(["from", table]);

        if (table === "documents") {
          return {
            select(columns) {
              operations.push(["documents.select", columns]);
              return this;
            },
            eq(column, value) {
              operations.push(["documents.eq", column, value]);
              return this;
            },
            maybeSingle() {
              return {
                data: {
                  id: "document-9",
                },
                error: null,
              };
            },
          };
        }

        if (table === "document_notes") {
          return {
            insert(payload) {
              operations.push(["notes.insert", payload]);
              return this;
            },
            select(columns) {
              operations.push(["notes.select", columns]);
              return this;
            },
            single() {
              return {
                data: {
                  id: "note-2",
                  document_id: "document-9",
                  title: "My note",
                  content: "Remember the sorted input requirement.",
                  note_type: "manual",
                  created_at: "2026-06-01T07:00:00.000Z",
                },
                error: null,
              };
            },
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      },
    }),
    generateNotes: async () => {
      throw new Error("generateNotes should not be called for manual notes");
    },
  });

  const response = await POST(
    new Request("http://localhost/api/study/notes", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        documentId: "document-9",
        title: "  My note  ",
        content: "  Remember the sorted input requirement.  ",
      }),
    }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(
    operations.filter(([name]) => name === "notes.insert"),
    [
      [
        "notes.insert",
        {
          document_id: "document-9",
          user_id: "user-1",
          title: "My note",
          content: "Remember the sorted input requirement.",
          note_type: "manual",
        },
      ],
    ],
  );
  assert.deepEqual(await response.json(), {
    id: "note-2",
    documentId: "document-9",
    title: "My note",
    content: "Remember the sorted input requirement.",
    noteType: "manual",
    createdAt: "2026-06-01T07:00:00.000Z",
  });
});

test("study notes POST rejects empty manual note content", async () => {
  const { POST } = createStudyNotesRoute({
    createClient: async () => ({
      auth: {
        async getUser() {
          return {
            data: {
              user: { id: "user-1" },
            },
          };
        },
      },
      from() {
        throw new Error("from() should not be called for invalid manual notes");
      },
    }),
    generateNotes: async () => {
      throw new Error("generateNotes should not be called for invalid manual notes");
    },
  });

  const response = await POST(
    new Request("http://localhost/api/study/notes", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        documentId: "document-9",
        content: "  ",
      }),
    }),
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: "content is required.",
  });
});

test("study notes POST generates and saves AI notes for a ready owned document", async () => {
  let capturedCall = null;
  const operations = [];
  const { POST } = createStudyNotesRoute({
    createClient: async () => ({
      auth: {
        async getUser() {
          return {
            data: {
              user: { id: "user-1" },
            },
          };
        },
      },
      from(table) {
        operations.push(["from", table]);

        if (table === "documents") {
          return {
            select(columns) {
              operations.push(["documents.select", columns]);
              return this;
            },
            eq(column, value) {
              operations.push(["documents.eq", column, value]);
              return this;
            },
            maybeSingle() {
              return {
                data: {
                  id: "document-9",
                  file_name: "Algorithms Notes",
                  raw_text: "Binary search uses a sorted array.",
                  summary: "Binary search repeatedly halves the candidate range.",
                  processing_status: "completed",
                },
                error: null,
              };
            },
          };
        }

        if (table === "document_notes") {
          return {
            insert(payload) {
              operations.push(["notes.insert", payload]);
              return this;
            },
            select(columns) {
              operations.push(["notes.select", columns]);
              return this;
            },
            single() {
              return {
                data: sampleSavedNote,
                error: null,
              };
            },
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      },
    }),
    generateNotes: async (documentText, options) => {
      capturedCall = { documentText, options };

      return sampleGeneratedNotes;
    },
  });

  const response = await POST(
    new Request("http://localhost/api/study/notes", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        documentId: "document-9",
        mode: "ai",
      }),
    }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(capturedCall, {
    documentText: "Binary search uses a sorted array.",
    options: {
      documentTitle: "Algorithms Notes",
      summary: "Binary search repeatedly halves the candidate range.",
    },
  });
  assert.deepEqual(
    operations.filter(([name]) => name === "notes.insert"),
    [
      [
        "notes.insert",
        {
          document_id: "document-9",
          user_id: "user-1",
          title: "Study Notes",
          content: sampleGeneratedNotes,
          note_type: "ai_summary",
        },
      ],
    ],
  );
  assert.deepEqual(await response.json(), {
    id: "note-1",
    documentId: "document-9",
    title: "Study Notes",
    content: sampleGeneratedNotes,
    noteType: "ai_summary",
    createdAt: "2026-06-01T06:00:00.000Z",
  });
});

test("study notes GET requires documentId", async () => {
  const { GET } = createStudyNotesRoute({
    createClient: async () => ({
      auth: {
        async getUser() {
          return {
            data: {
              user: { id: "user-1" },
            },
          };
        },
      },
      from() {
        throw new Error("from() should not be called without documentId");
      },
    }),
    generateNotes: async () => {
      throw new Error("generateNotes should not be called when listing notes");
    },
  });

  const response = await GET(
    new Request("http://localhost/api/study/notes", {
      method: "GET",
    }),
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: "documentId is required.",
  });
});

test("study notes GET returns current user notes for a document newest first", async () => {
  const operations = [];
  const { GET } = createStudyNotesRoute({
    createClient: async () => ({
      auth: {
        async getUser() {
          return {
            data: {
              user: { id: "user-1" },
            },
          };
        },
      },
      from(table) {
        assert.equal(table, "document_notes");

        return {
          select(columns) {
            operations.push(["notes.select", columns]);
            return this;
          },
          eq(column, value) {
            operations.push(["notes.eq", column, value]);
            return this;
          },
          order(column, options) {
            operations.push(["notes.order", column, options]);

            if (column === "id") {
              return {
                data: [sampleSavedNote],
                error: null,
              };
            }

            return this;
          },
        };
      },
    }),
    generateNotes: async () => {
      throw new Error("generateNotes should not be called when listing notes");
    },
  });

  const response = await GET(
    new Request("http://localhost/api/study/notes?documentId=document-9", {
      method: "GET",
    }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(operations, [
    ["notes.select", "id, document_id, title, content, note_type, created_at"],
    ["notes.eq", "user_id", "user-1"],
    ["notes.eq", "document_id", "document-9"],
    ["notes.order", "created_at", { ascending: false }],
    ["notes.order", "id", { ascending: false }],
  ]);
  assert.deepEqual(await response.json(), [
    {
      id: "note-1",
      documentId: "document-9",
      title: "Study Notes",
      content: sampleGeneratedNotes,
      noteType: "ai_summary",
      createdAt: "2026-06-01T06:00:00.000Z",
    },
  ]);
});

test("study notes DELETE removes a current user saved note", async () => {
  const operations = [];
  const { DELETE } = createStudyNotesRoute({
    createClient: async () => ({
      auth: {
        async getUser() {
          return {
            data: {
              user: { id: "user-1" },
            },
          };
        },
      },
      from(table) {
        assert.equal(table, "document_notes");

        return {
          delete() {
            operations.push(["notes.delete"]);
            return this;
          },
          eq(column, value) {
            operations.push(["notes.eq", column, value]);

            if (column === "user_id") {
              return {
                error: null,
              };
            }

            return this;
          },
        };
      },
    }),
    generateNotes: async () => {
      throw new Error("generateNotes should not be called when deleting notes");
    },
  });

  const response = await DELETE(
    new Request("http://localhost/api/study/notes", {
      method: "DELETE",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        noteId: "note-1",
      }),
    }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(operations, [
    ["notes.delete"],
    ["notes.eq", "id", "note-1"],
    ["notes.eq", "user_id", "user-1"],
  ]);
  assert.deepEqual(await response.json(), {
    success: true,
  });
});

test("study notes DELETE requires a note id", async () => {
  const { DELETE } = createStudyNotesRoute({
    createClient: async () => ({
      auth: {
        async getUser() {
          return {
            data: {
              user: { id: "user-1" },
            },
          };
        },
      },
      from() {
        throw new Error("from() should not be called for invalid delete requests");
      },
    }),
    generateNotes: async () => {
      throw new Error("generateNotes should not be called for invalid delete requests");
    },
  });

  const response = await DELETE(
    new Request("http://localhost/api/study/notes", {
      method: "DELETE",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({}),
    }),
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: "noteId is required.",
  });
});

test("study notes route rejects unauthorized users", async () => {
  const { POST, GET, DELETE } = createStudyNotesRoute({
    createClient: async () => ({
      auth: {
        async getUser() {
          return {
            data: {
              user: null,
            },
          };
        },
      },
      from() {
        throw new Error("from() should not be called for unauthorized requests");
      },
    }),
    generateNotes: async () => {
      throw new Error("generateNotes should not be called for unauthorized requests");
    },
  });

  const postResponse = await POST(
    new Request("http://localhost/api/study/notes", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        documentId: "document-9",
        content: "Manual note.",
      }),
    }),
  );
  const getResponse = await GET(
    new Request("http://localhost/api/study/notes?documentId=document-9", {
      method: "GET",
    }),
  );
  const deleteResponse = await DELETE(
    new Request("http://localhost/api/study/notes", {
      method: "DELETE",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        noteId: "note-1",
      }),
    }),
  );

  assert.equal(postResponse.status, 401);
  assert.equal(getResponse.status, 401);
  assert.equal(deleteResponse.status, 401);
});
