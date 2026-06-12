import assert from "node:assert/strict";
import test from "node:test";
import {
  getAuthRedirectPath,
  isProtectedApiPath,
  isProtectedPagePath,
} from "../src/lib/auth-protection.ts";

test("isProtectedPagePath covers all authenticated app pages", () => {
  assert.equal(isProtectedPagePath("/dashboard"), true);
  assert.equal(isProtectedPagePath("/documents"), true);
  assert.equal(isProtectedPagePath("/documents/document-1"), true);
  assert.equal(isProtectedPagePath("/chat"), true);
  assert.equal(isProtectedPagePath("/review"), true);
  assert.equal(isProtectedPagePath("/quiz/quiz-1"), true);
  assert.equal(isProtectedPagePath("/login"), false);
});

test("getAuthRedirectPath redirects anonymous users and signed-in login visits", () => {
  assert.equal(getAuthRedirectPath("/chat", false), "/login");
  assert.equal(getAuthRedirectPath("/documents/document-1", false), "/login");
  assert.equal(getAuthRedirectPath("/quiz/quiz-1", false), "/login");
  assert.equal(getAuthRedirectPath("/login", true), "/dashboard");
  assert.equal(getAuthRedirectPath("/dashboard", true), null);
});

test("isProtectedApiPath covers authenticated API namespaces", () => {
  assert.equal(isProtectedApiPath("/api/documents/upload"), true);
  assert.equal(isProtectedApiPath("/api/documents/document-1/delete"), true);
  assert.equal(isProtectedApiPath("/api/rag/answer"), true);
  assert.equal(isProtectedApiPath("/api/study/quiz"), true);
  assert.equal(isProtectedApiPath("/api/chat/messages"), true);
  assert.equal(isProtectedApiPath("/api/auth"), false);
});
