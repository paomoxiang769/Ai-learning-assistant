import assert from "node:assert/strict";
import test from "node:test";
import {
  getDocumentChatViewModel,
  getSourcesSummaryLabel,
} from "../src/lib/document-chat-ui.ts";

test("getDocumentChatViewModel shows empty state when no messages exist", () => {
  assert.deepEqual(
    getDocumentChatViewModel({
      canAsk: true,
      isSubmitting: false,
      messageCount: 0,
    }),
    {
      disableAsk: false,
      showEmptyState: true,
      showThinkingState: false,
    },
  );
});

test("getDocumentChatViewModel shows thinking state and disables ask while submitting", () => {
  assert.deepEqual(
    getDocumentChatViewModel({
      canAsk: true,
      isSubmitting: true,
      messageCount: 1,
    }),
    {
      disableAsk: true,
      showEmptyState: false,
      showThinkingState: true,
    },
  );
});

test("getDocumentChatViewModel disables ask when the document is not ready", () => {
  assert.deepEqual(
    getDocumentChatViewModel({
      canAsk: false,
      isSubmitting: false,
      messageCount: 2,
    }),
    {
      disableAsk: true,
      showEmptyState: false,
      showThinkingState: false,
    },
  );
});

test("getSourcesSummaryLabel includes the source count", () => {
  assert.equal(getSourcesSummaryLabel(3), "Sources (3)");
});
