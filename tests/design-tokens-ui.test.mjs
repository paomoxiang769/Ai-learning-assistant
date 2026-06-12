import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const globalsCss = await readFile(
  new URL("../src/app/globals.css", import.meta.url),
  "utf8",
);

test("global styles expose the target UI design tokens", () => {
  assert.match(globalsCss, /--canvas:\s*#f1f5f9;/);
  assert.match(globalsCss, /--workspace:\s*#f8fafc;/);
  assert.match(globalsCss, /--ink:\s*#0f172a;/);
  assert.match(globalsCss, /--brand:\s*#4f46e5;/);
  assert.match(globalsCss, /--brand-soft:\s*#eef2ff;/);
  assert.match(globalsCss, /--panel-radius:\s*8px;/);
  assert.match(globalsCss, /--control-radius:\s*8px;/);
  assert.match(globalsCss, /--shadow-crisp:\s*0 1px 3px rgba\(15,\s*23,\s*42,\s*0\.06\);/);
});

test("common cards and controls use compact SaaS styling", () => {
  assert.match(globalsCss, /\.card,[\s\S]*?border-radius:\s*var\(--panel-radius\);/);
  assert.match(globalsCss, /\.card,[\s\S]*?background:\s*var\(--surface-card\);/);
  assert.match(globalsCss, /\.button\s*\{[\s\S]*?border-radius:\s*var\(--control-radius\);/);
  assert.match(globalsCss, /\.button\s*\{[\s\S]*?font-size:\s*0\.82rem;/);
  assert.match(globalsCss, /\.ui-modal-card\s*\{[\s\S]*?border-radius:\s*var\(--panel-radius\);/);
});
