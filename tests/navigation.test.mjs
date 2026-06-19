import assert from "node:assert/strict";
import test from "node:test";
import {
  getMainNavigationItems,
  getWorkspaceTopbarViewModel,
  isMainNavigationItemActive,
} from "../src/lib/navigation.ts";

test("getMainNavigationItems returns the main sidebar routes", () => {
  const navigationItems = getMainNavigationItems();

  assert.deepEqual(
    navigationItems.map((item) => ({
      label: item.label,
      href: item.href,
    })),
    [
      {
        label: "Dashboard",
        href: "/dashboard",
      },
      {
        label: "Documents",
        href: "/documents",
      },
      {
        label: "Knowledge Base",
        href: "/chat",
      },
      {
        label: "Review Center",
        href: "/review",
      },
    ],
  );
  assert.deepEqual(
    navigationItems.map((item) => item.iconId),
    ["dashboard", "documents", "knowledge", "review"],
  );
  assert.ok(navigationItems.every((item) => !("iconLabel" in item)));
  assert.ok(navigationItems.every((item) => !("labelKey" in item)));
});

test("isMainNavigationItemActive matches exact and nested routes", () => {
  assert.equal(isMainNavigationItemActive("/dashboard", "/dashboard"), true);
  assert.equal(isMainNavigationItemActive("/documents", "/documents/abc"), true);
  assert.equal(isMainNavigationItemActive("/chat", "/chat"), true);
  assert.equal(isMainNavigationItemActive("/review", "/review?tab=notes"), true);
  assert.equal(isMainNavigationItemActive("/documents", "/chat"), false);
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
