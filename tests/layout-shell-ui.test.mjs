import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sidebarSource = await readFile(
  new URL("../src/components/app-sidebar.tsx", import.meta.url),
  "utf8",
);
const topbarSource = await readFile(
  new URL("../src/components/app-topbar.tsx", import.meta.url),
  "utf8",
);
const globalsCss = await readFile(
  new URL("../src/app/globals.css", import.meta.url),
  "utf8",
);

test("sidebar brand mirrors the target UI hierarchy", () => {
  assert.match(sidebarSource, /MindPalette/);
  assert.match(sidebarSource, /AI Study Assistant/);
  assert.match(sidebarSource, /sidebar-brand-mark/);
  assert.match(sidebarSource, /sidebar-status-meter/);
});

test("topbar includes target UI status, search, action, and profile capsule", () => {
  assert.match(topbarSource, /topbar-status-chip/);
  assert.match(topbarSource, /topbar-search/);
  assert.match(topbarSource, /topbar-action-button/);
  assert.match(topbarSource, /topbar-profile/);
  assert.match(topbarSource, /AC/);
});

test("layout shell CSS keeps the target dark sidebar and compact topbar", () => {
  assert.match(globalsCss, /\.app-shell\s*\{[\s\S]*?grid-template-columns:\s*15rem minmax\(0,\s*1fr\);/);
  assert.match(globalsCss, /\.app-sidebar\s*\{[\s\S]*?background:\s*var\(--sidebar\);/);
  assert.match(globalsCss, /\.app-topbar\s*\{[\s\S]*?min-height:\s*4\.05rem;/);
  assert.match(globalsCss, /\.topbar-profile\s*\{[\s\S]*?border-left:\s*1px solid var\(--border\);/);
});
