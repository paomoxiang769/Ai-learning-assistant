import assert from "node:assert/strict";
import test from "node:test";
import { formatRawTextPreview } from "../src/lib/raw-text-preview.ts";

test("formatRawTextPreview sanitizes PDF glyph residue for display only", () => {
  assert.equal(
    formatRawTextPreview(
      "Alpha\u25A0\u0007Beta \u25A1 Gamma\uFFFD Delta \u25AA Epsilon \u25FC Zeta",
      500,
    ),
    "Alpha\u2022 Beta Gamma Delta Epsilon Zeta",
  );
});

test("formatRawTextPreview truncates after sanitization", () => {
  assert.equal(
    formatRawTextPreview("One \u25AA Two Three Four", 9),
    "One Two T...",
  );
});

test("formatRawTextPreview preserves empty fallback text", () => {
  assert.equal(
    formatRawTextPreview(null, 500),
    "No parsed text is available yet.",
  );
});
