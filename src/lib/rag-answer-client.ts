type RagAnswerSource = {
  id: string;
  documentId: string;
  documentTitle?: string;
  chunkIndex: number;
  content: string;
  similarity: number;
};

type RagAnswerPayload = {
  answer: string;
  chunks: RagAnswerSource[];
};

type SourcePreviewAnalysis = {
  kind: "readable" | "low_quality_preview";
  preview: string;
  keywords: string[];
  excerpt: string;
};

const SOURCE_PREVIEW_MAX_LENGTH = 400;
const LOW_QUALITY_EXCERPT_MIN_LENGTH = 80;
const LOW_QUALITY_EXCERPT_MAX_LENGTH = 150;
const LOW_QUALITY_PREVIEW_MESSAGE =
  "This source contains table/code-like content. Preview may lose original formatting.";
const PAGE_MARKER_LINE_PATTERN =
  /^--\s*\d+\s*(?:\u5171\s*\d+|\/\s*\d+)\s*--$/;
const ISOLATED_NUMBER_LINE_PATTERN = /^\d+$/;
const MEANINGFUL_CHARACTER_PATTERN = /[A-Za-z\u4e00-\u9fff]/g;
const ENGLISH_KEYWORD_PATTERN = /[A-Za-z]{4,}/g;
const CHINESE_KEYWORD_PATTERN = /[\u4e00-\u9fff]{2,}/g;
const SENTENCE_STRUCTURE_PATTERN = /[.!?;:\u3002\uff01\uff1f\uff1b]/;
const STOPWORD_PATTERN =
  /\b(the|is|are|was|were|be|being|been|and|or|but|to|of|in|on|for|with|from|that|this|these|those|it|its|as|by|an|a)\b/gi;
const GLYPH_REPLACEMENTS: Array<[RegExp, string]> = [
  [/[\u25A0-\u25A1\u25AA-\u25AB\u25FC-\u25FF]/g, " "],
  [/\uFFFD/g, " "],
];

function sanitizePreviewGlyphs(content: string) {
  return GLYPH_REPLACEMENTS.reduce(
    (currentContent, [pattern, replacement]) =>
      currentContent.replace(pattern, replacement),
    content,
  ).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ");
}

function isValidSource(source: unknown): source is RagAnswerSource {
  if (!source || typeof source !== "object") {
    return false;
  }

  const candidate = source as Record<string, unknown>;

  return (
    typeof candidate.id === "string" &&
    typeof candidate.documentId === "string" &&
    (candidate.documentTitle === undefined ||
      typeof candidate.documentTitle === "string") &&
    typeof candidate.chunkIndex === "number" &&
    typeof candidate.content === "string" &&
    typeof candidate.similarity === "number"
  );
}

function cleanSourcePreviewText(content: string) {
  return sanitizePreviewGlyphs(content)
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(
      (line) =>
        line &&
        !PAGE_MARKER_LINE_PATTERN.test(line) &&
        !ISOLATED_NUMBER_LINE_PATTERN.test(line),
    )
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanLowQualityExcerptText(content: string) {
  return sanitizePreviewGlyphs(content)
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !PAGE_MARKER_LINE_PATTERN.test(line))
    .map((line) =>
      line
        .replace(/\b\d{4,}\b/g, " ")
        .replace(/\b(?:[\p{L}\p{N}])\b(?:\s+\b(?:[\p{L}\p{N}])\b){3,}/gu, " ")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter((line) => {
      if (!line) {
        return false;
      }

      const digitGroups = line.match(/\d+(?:\.\d+)?/g) ?? [];
      const letterCount = countMeaningfulCharacters(line);
      const digitCharacterCount = (line.match(/\d/g) ?? []).length;
      const nonSpaceCharacters = line.replace(/\s/g, "");
      const digitRatio =
        nonSpaceCharacters.length === 0
          ? 1
          : digitCharacterCount / nonSpaceCharacters.length;

      if (digitGroups.length >= 4 && letterCount < 12) {
        return false;
      }

      if (digitRatio >= 0.4 && letterCount < 16) {
        return false;
      }

      return true;
    })
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function countMeaningfulCharacters(content: string) {
  return content.match(MEANINGFUL_CHARACTER_PATTERN)?.length ?? 0;
}

function truncatePreview(content: string) {
  if (content.length <= SOURCE_PREVIEW_MAX_LENGTH) {
    return content;
  }

  return `${content.slice(0, SOURCE_PREVIEW_MAX_LENGTH)}...`;
}

function buildLowQualityExcerpt(content: string) {
  if (!content) {
    return "";
  }

  if (countMeaningfulCharacters(content) < 20) {
    return "";
  }

  if (content.length <= LOW_QUALITY_EXCERPT_MAX_LENGTH) {
    return content;
  }

  const slicedContent = content.slice(0, LOW_QUALITY_EXCERPT_MAX_LENGTH);
  const lastSpaceIndex = slicedContent.lastIndexOf(" ");

  if (lastSpaceIndex >= LOW_QUALITY_EXCERPT_MIN_LENGTH) {
    return `${slicedContent.slice(0, lastSpaceIndex)}...`;
  }

  return `${slicedContent}...`;
}

function getNormalizedTokens(content: string) {
  return content
    .split(/\s+/)
    .map((token) => token.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ""))
    .filter(Boolean);
}

function extractKeywords(content: string) {
  const matches = [
    ...(content.match(ENGLISH_KEYWORD_PATTERN) ?? []).map((token) =>
      token.toLowerCase(),
    ),
    ...(content.match(CHINESE_KEYWORD_PATTERN) ?? []),
  ];
  const keywords: string[] = [];

  for (const token of matches) {
    if (!keywords.includes(token)) {
      keywords.push(token);
    }

    if (keywords.length === 6) {
      break;
    }
  }

  return keywords;
}

function isLowQualityPreview(content: string) {
  const nonSpaceCharacters = content.replace(/\s/g, "");

  if (!nonSpaceCharacters) {
    return true;
  }

  const tokens = getNormalizedTokens(content);
  const digitCharacterCount = (content.match(/\d/g) ?? []).length;
  const digitRatio = digitCharacterCount / nonSpaceCharacters.length;
  const singleCharacterTokenCount = tokens.filter((token) => token.length === 1).length;
  const singleCharacterTokenRatio =
    tokens.length === 0 ? 1 : singleCharacterTokenCount / tokens.length;
  const noisySequenceCount = (
    content.match(/(?:\d[\d\W_]{4,}|[\W_]{5,})/g) ?? []
  ).length;
  const stopwordCount = (content.match(STOPWORD_PATTERN) ?? []).length;
  const hasSentenceStructure =
    SENTENCE_STRUCTURE_PATTERN.test(content) || stopwordCount >= 2;

  return (
    countMeaningfulCharacters(content) < 12 ||
    digitRatio >= 0.3 ||
    (tokens.length >= 6 && singleCharacterTokenRatio >= 0.45) ||
    noisySequenceCount >= 2 ||
    !hasSentenceStructure
  );
}

export function normalizeRagAnswerPayload(payload: unknown): RagAnswerPayload {
  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid RAG answer response.");
  }

  const candidate = payload as Record<string, unknown>;

  if (
    typeof candidate.answer !== "string" ||
    !Array.isArray(candidate.chunks) ||
    !candidate.chunks.every(isValidSource)
  ) {
    throw new Error("Invalid RAG answer response.");
  }

  return {
    answer: candidate.answer,
    chunks: candidate.chunks,
  };
}

export function formatSourceSimilarity(similarity: number) {
  return `${(similarity * 100).toFixed(1)}%`;
}

export function analyzeSourcePreview(content: string): SourcePreviewAnalysis {
  const cleanedContent = cleanSourcePreviewText(content);
  const cleanedExcerptContent = cleanLowQualityExcerptText(content);
  const keywords = extractKeywords(cleanedContent);

  if (!cleanedContent || isLowQualityPreview(cleanedContent)) {
    return {
      kind: "low_quality_preview",
      preview: LOW_QUALITY_PREVIEW_MESSAGE,
      keywords,
      excerpt: buildLowQualityExcerpt(cleanedExcerptContent),
    };
  }

  return {
    kind: "readable",
    preview: truncatePreview(cleanedContent),
    keywords,
    excerpt: "",
  };
}

export function formatSourcePreview(content: string) {
  return analyzeSourcePreview(content).preview;
}

export type { RagAnswerPayload, RagAnswerSource, SourcePreviewAnalysis };
