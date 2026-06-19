import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readSource(path) {
  return readFile(new URL(path, import.meta.url), "utf8").catch(() => "");
}

const sidebarSource = await readFile(
  new URL("../src/components/app-sidebar.tsx", import.meta.url),
  "utf8",
);
const topbarSource = await readFile(
  new URL("../src/components/app-topbar.tsx", import.meta.url),
  "utf8",
);
const layoutSource = await readFile(
  new URL("../src/app/layout.tsx", import.meta.url),
  "utf8",
);
const globalsCss = await readFile(
  new URL("../src/app/globals.css", import.meta.url),
  "utf8",
);
const loginPageSource = await readFile(
  new URL("../src/app/login/page.tsx", import.meta.url),
  "utf8",
);
const ferrofluidSource = await readSource("../src/components/ferrofluid.tsx");
const packageJsonSource = await readFile(
  new URL("../package.json", import.meta.url),
  "utf8",
);

test("sidebar brand mirrors the target UI hierarchy", () => {
  assert.match(sidebarSource, /MindPalette/);
  assert.match(sidebarSource, /AI Study Assistant/);
  assert.match(sidebarSource, /sidebar-brand-mark/);
  assert.doesNotMatch(sidebarSource, /getSidebarWorkspaceStatus/);
  assert.doesNotMatch(sidebarSource, /sidebar-status-card/);
  assert.doesNotMatch(sidebarSource, /sidebar-status-meter/);
});

test("sidebar navigation uses icon ids that match the shell style", () => {
  assert.match(sidebarSource, /sidebar-nav-icon/);
  assert.match(sidebarSource, /SidebarNavIcon/);
  assert.match(sidebarSource, /item\.iconId/);
  assert.doesNotMatch(sidebarSource, /item\.iconLabel/);
  assert.match(sidebarSource, /<strong>\{item\.label\}<\/strong>/);
  assert.doesNotMatch(sidebarSource, /item\.description/);
  assert.doesNotMatch(sidebarSource, /sidebar-nav-tag/);
  assert.doesNotMatch(sidebarSource, /item\.tag/);
  assert.doesNotMatch(sidebarSource, /<small>\{item\.description\}<\/small>/);
});

test("topbar includes target UI status, search, action, and profile capsule", () => {
  assert.match(topbarSource, /topbar-status-chip/);
  assert.match(topbarSource, /topbar-search/);
  assert.match(topbarSource, /placeholder="Search in dashboard"/);
  assert.match(topbarSource, /topbar-action-button/);
  assert.match(topbarSource, /topbar-profile/);
  assert.match(topbarSource, /AC/);
});

test("app shell does not expose language switching", () => {
  assert.doesNotMatch(layoutSource, /LanguageProvider/);
  assert.doesNotMatch(topbarSource, /useLanguage/);
  assert.doesNotMatch(topbarSource, /language-switcher/);
  assert.doesNotMatch(topbarSource, /setLocale/);
  assert.doesNotMatch(topbarSource, /supportedLocales/);
  assert.doesNotMatch(topbarSource, /EN/);
  assert.doesNotMatch(sidebarSource, /useLanguage/);
  assert.doesNotMatch(globalsCss, /\.language-switcher/);
});

test("layout shell CSS keeps the monochrome sidebar and compact topbar", () => {
  assert.match(globalsCss, /\.app-shell\s*\{[\s\S]*?grid-template-columns:\s*15rem minmax\(0,\s*1fr\);/);
  assert.match(globalsCss, /\.app-sidebar\s*\{[\s\S]*?background:\s*#f2f2f2;/);
  assert.match(globalsCss, /\.app-sidebar\s*\{[\s\S]*?justify-content:\s*flex-start;/);
  assert.match(globalsCss, /\.app-topbar\s*\{[\s\S]*?min-height:\s*4\.05rem;/);
  assert.match(globalsCss, /\.topbar-profile\s*\{[\s\S]*?border-left:\s*1px solid var\(--border\);/);
  assert.match(globalsCss, /\.sidebar-nav-icon\s*\{[\s\S]*?width:\s*1\.95rem;[\s\S]*?height:\s*1\.65rem;/);
});

test("login page uses a clean centered Ferrofluid auth surface", () => {
  assert.match(loginPageSource, /import Ferrofluid from "@\/components\/ferrofluid";/);
  assert.match(loginPageSource, /<Ferrofluid/);
  assert.doesNotMatch(loginPageSource, /login-intro/);
  assert.doesNotMatch(loginPageSource, /login-helper-list/);
  assert.match(globalsCss, /\.login-page\s*\{[\s\S]*?min-height:\s*100svh;/);
  assert.match(globalsCss, /\.login-panel\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*26rem\);/);
  assert.match(globalsCss, /body:has\(\.login-page\)\s+\.app-sidebar\s*\{[\s\S]*?display:\s*none;/);
  assert.match(globalsCss, /body:has\(\.login-page\)\s+\.app-topbar\s*\{[\s\S]*?display:\s*none;/);
});

test("login card uses a dark glassmorphism treatment", () => {
  assert.match(globalsCss, /\.login-card\s*\{[\s\S]*?border:\s*1px solid rgba\(255,\s*255,\s*255,\s*0\.15\);/);
  assert.match(globalsCss, /\.login-card\s*\{[\s\S]*?background:\s*rgba\(255,\s*255,\s*255,\s*0\.06\);/);
  assert.match(globalsCss, /\.login-card\s*\{[\s\S]*?backdrop-filter:\s*blur\(16px\);/);
  assert.match(globalsCss, /\.login-card\s*\{[\s\S]*?-webkit-backdrop-filter:\s*blur\(16px\);/);
  assert.match(globalsCss, /\.login-card \.login-card-heading h2\s*\{[\s\S]*?color:\s*#ffffff;/);
  assert.match(globalsCss, /\.login-card \.login-card-heading p,\s*\.login-card \.form-field\s*\{[\s\S]*?color:\s*#e2e8f0;/);
  assert.match(globalsCss, /\.login-card \.form-field input\s*\{[\s\S]*?background:\s*rgba\(255,\s*255,\s*255,\s*0\.08\);/);
  assert.match(globalsCss, /\.login-card \.button\.secondary\s*\{[\s\S]*?background:\s*rgba\(255,\s*255,\s*255,\s*0\.08\);/);
});

test("Ferrofluid is a typed OGL client component", () => {
  assert.match(packageJsonSource, /"ogl":\s*"\^1\.0\.11"/);
  assert.match(ferrofluidSource, /"use client"/);
  assert.match(ferrofluidSource, /from "ogl"/);
  assert.match(ferrofluidSource, /type FerrofluidProps/);
  assert.match(ferrofluidSource, /ResizeObserver/);
  assert.match(ferrofluidSource, /mouseDampening/);
});
