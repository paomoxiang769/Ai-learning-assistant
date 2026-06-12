import assert from "node:assert/strict";
import test from "node:test";
import {
  getMainNavigationItems,
  getSidebarWorkspaceStatus,
  getWorkspaceTopbarViewModel,
  isMainNavigationItemActive,
} from "../src/lib/navigation.ts";

test("getMainNavigationItems returns the main sidebar routes", () => {
  assert.deepEqual(getMainNavigationItems(), [
    {
      label: "Dashboard",
      href: "/dashboard",
      iconLabel: "DB",
      description: "Bento study overview",
      tag: null,
    },
    {
      label: "Documents",
      href: "/documents",
      iconLabel: "DS",
      description: "Source library",
      tag: "Core",
    },
    {
      label: "Knowledge Base",
      href: "/chat",
      iconLabel: "KB",
      description: "Cross-document chat",
      tag: "AI",
    },
    {
      label: "Review Center",
      href: "/review",
      iconLabel: "RV",
      description: "History and notes",
      tag: null,
    },
  ]);
});

test("isMainNavigationItemActive matches exact and nested routes", () => {
  assert.equal(isMainNavigationItemActive("/dashboard", "/dashboard"), true);
  assert.equal(isMainNavigationItemActive("/documents", "/documents/abc"), true);
  assert.equal(isMainNavigationItemActive("/chat", "/chat"), true);
  assert.equal(isMainNavigationItemActive("/review", "/review?tab=notes"), true);
  assert.equal(isMainNavigationItemActive("/documents", "/chat"), false);
});

test("getSidebarWorkspaceStatus returns the study workspace status card", () => {
  assert.deepEqual(getSidebarWorkspaceStatus(), {
    eyebrow: "Study workspace",
    title: "AI learning loop",
    description: "Upload, ask, quiz, note, and review from one focused space.",
    meterLabel: "Review readiness",
    meterValue: 70,
  });
});

test("getWorkspaceTopbarViewModel returns workspace titles for known routes", () => {
  assert.deepEqual(getWorkspaceTopbarViewModel("/dashboard"), {
    section: "My workspace",
    title: "Dashboard",
    actionLabel: "Open documents",
    actionHref: "/documents",
    assistantStatus: "AI workspace ready",
  });

  assert.deepEqual(getWorkspaceTopbarViewModel("/documents/document-1"), {
    section: "My workspace",
    title: "Documents",
    actionLabel: "Open dashboard",
    actionHref: "/dashboard",
    assistantStatus: "AI workspace ready",
  });

  assert.deepEqual(getWorkspaceTopbarViewModel("/quiz/document-1"), {
    section: "My workspace",
    title: "Quiz",
    actionLabel: "Open dashboard",
    actionHref: "/dashboard",
    assistantStatus: "AI workspace ready",
  });
});
