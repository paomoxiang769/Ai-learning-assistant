import assert from "node:assert/strict";
import test from "node:test";
import { createDocumentDeleteRoute } from "../src/lib/document-delete-route.ts";

test("document delete route returns 401 when the user is not authenticated", async () => {
  const { POST } = createDocumentDeleteRoute({
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
      storage: {
        from() {
          throw new Error("storage should not be used when unauthenticated");
        },
      },
      from() {
        throw new Error("database should not be queried when unauthenticated");
      },
    }),
  });

  const response = await POST(
    new Request("http://localhost/api/documents/document-1/delete", {
      method: "POST",
    }),
    {
      params: Promise.resolve({ id: "document-1" }),
    },
  );

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "Unauthorized." });
});

test("document delete route skips storage removal for URL file paths and deletes the document record", async () => {
  const operations = [];
  let deleteEqCount = 0;
  const { POST } = createDocumentDeleteRoute({
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
      storage: {
        from() {
          throw new Error("storage.remove should not be called for URL file paths");
        },
      },
      from(table) {
        if (table === "document_chunks") {
          return {
            delete() {
              operations.push(["chunks.delete"]);
              return this;
            },
            eq(column, value) {
              operations.push(["chunks.eq", column, value]);
              return {
                error: null,
              };
            },
          };
        }

        assert.equal(table, "documents");

        return {
          select(columns) {
            operations.push(["documents.select", columns]);
            return this;
          },
          delete() {
            operations.push(["documents.delete"]);
            deleteEqCount = 0;
            return this;
          },
          eq(column, value) {
            operations.push(["documents.eq", column, value]);

            if (operations.some(([name]) => name === "documents.delete")) {
              deleteEqCount += 1;

              if (deleteEqCount === 2) {
                return {
                  error: null,
                };
              }
            }

            return this;
          },
          maybeSingle() {
            return {
              data: {
                file_path: "https://example.com/legacy-file.pdf",
              },
              error: null,
            };
          },
        };
      },
    }),
  });

  const response = await POST(
    new Request("http://localhost/api/documents/document-1/delete", {
      method: "POST",
    }),
    {
      params: Promise.resolve({ id: "document-1" }),
    },
  );

  assert.equal(response.status, 303);
  assert.equal(response.headers.get("location"), "http://localhost/documents?message=Document+deleted+successfully.");
  assert.deepEqual(operations, [
    ["documents.select", "file_path"],
    ["documents.eq", "id", "document-1"],
    ["documents.eq", "user_id", "user-1"],
    ["chunks.delete"],
    ["chunks.eq", "document_id", "document-1"],
    ["documents.delete"],
    ["documents.eq", "id", "document-1"],
    ["documents.eq", "user_id", "user-1"],
  ]);
});

test("document delete route still deletes the document record when storage removal fails", async () => {
  const operations = [];
  let deleteEqCount = 0;
  const { POST } = createDocumentDeleteRoute({
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
      storage: {
        from(bucket) {
          operations.push(["storage.from", bucket]);

          return {
            async remove(paths) {
              operations.push(["storage.remove", paths]);

              return {
                error: {
                  message: "Storage delete blocked",
                },
              };
            },
          };
        },
      },
      from(table) {
        if (table === "document_chunks") {
          return {
            delete() {
              operations.push(["chunks.delete"]);
              return this;
            },
            eq(column, value) {
              operations.push(["chunks.eq", column, value]);
              return {
                error: null,
              };
            },
          };
        }

        assert.equal(table, "documents");

        return {
          select(columns) {
            operations.push(["documents.select", columns]);
            return this;
          },
          delete() {
            operations.push(["documents.delete"]);
            deleteEqCount = 0;
            return this;
          },
          eq(column, value) {
            operations.push(["documents.eq", column, value]);

            if (operations.some(([name]) => name === "documents.delete")) {
              deleteEqCount += 1;

              if (deleteEqCount === 2) {
                return {
                  error: null,
                };
              }
            }

            return this;
          },
          maybeSingle() {
            return {
              data: {
                file_path: "user-1/file.pdf",
              },
              error: null,
            };
          },
        };
      },
    }),
  });

  const response = await POST(
    new Request("http://localhost/api/documents/document-1/delete", {
      method: "POST",
    }),
    {
      params: Promise.resolve({ id: "document-1" }),
    },
  );

  const location = response.headers.get("location") ?? "";

  assert.equal(response.status, 303);
  assert.match(location, /^http:\/\/localhost\/documents\?/);
  assert.match(location, /message=Document\+deleted\+successfully/);
  assert.match(location, /warning=Document\+record\+was\+deleted/);
  assert.deepEqual(
    operations.filter(([name]) => name === "documents.delete"),
    [["documents.delete"]],
  );
});
