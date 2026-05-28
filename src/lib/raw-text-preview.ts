const RAW_TEXT_PREVIEW_FALLBACK = "No parsed text is available yet.";
const RAW_TEXT_PREVIEW_GLYPH_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\u25A0/g, "\u2022"],
  [/[\u25A1\u25AA\u25AB\u25FC\u25FD\u25FE\u25FF]/g, " "],
  [/\uFFFD/g, " "],
];

function sanitizeRawTextPreview(content: string) {
  return RAW_TEXT_PREVIEW_GLYPH_REPLACEMENTS.reduce(
    (currentContent, [pattern, replacement]) =>
      currentContent.replace(pattern, replacement),
    content,
  )
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/\r\n?/g, "\n")
    .replace(/\s+/g, " ")
    .trim();
}

export function formatRawTextPreview(rawText: string | null, maxLength = 500) {
  if (!rawText) {
    return RAW_TEXT_PREVIEW_FALLBACK;
  }

  const sanitizedPreview = sanitizeRawTextPreview(rawText);

  if (sanitizedPreview.length <= maxLength) {
    return sanitizedPreview;
  }

  return `${sanitizedPreview.slice(0, maxLength)}...`;
}

export { RAW_TEXT_PREVIEW_FALLBACK };
