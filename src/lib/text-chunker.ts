const MIN_CHUNK_LENGTH = 800;
const MAX_CHUNK_LENGTH = 1200;

function findSplitIndex(text: string) {
  const upperBound = Math.min(text.length, MAX_CHUNK_LENGTH);
  const lowerBound = Math.min(MIN_CHUNK_LENGTH, upperBound);

  for (let index = upperBound; index > lowerBound; index -= 1) {
    if (text[index - 1] === "\n") {
      return index;
    }
  }

  for (let index = upperBound; index > lowerBound; index -= 1) {
    if (/\s/.test(text[index - 1])) {
      return index;
    }
  }

  for (let index = upperBound; index > lowerBound; index -= 1) {
    if (/[.!?,;\u3002\uFF01\uFF1F\uFF1B\uFF0C]/.test(text[index - 1])) {
      return index;
    }
  }

  return upperBound;
}

function splitLongParagraph(paragraph: string) {
  const chunks: string[] = [];
  let remaining = paragraph;

  while (remaining.length > MAX_CHUNK_LENGTH) {
    const splitIndex = findSplitIndex(remaining);
    chunks.push(remaining.slice(0, splitIndex));
    remaining = remaining.slice(splitIndex);
  }

  if (remaining.length > 0) {
    chunks.push(remaining);
  }

  return chunks;
}

export function splitText(text: string) {
  if (!text.trim()) {
    return [];
  }

  const normalizedText = text.replace(/\r\n?/g, "\n");
  const paragraphs = normalizedText
    .split(/\n\s*\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const chunks: string[] = [];
  let currentChunkParts: string[] = [];
  let currentChunkLength = 0;

  function flushCurrentChunk() {
    if (currentChunkParts.length === 0) {
      return;
    }

    chunks.push(currentChunkParts.join("\n\n"));
    currentChunkParts = [];
    currentChunkLength = 0;
  }

  for (const paragraph of paragraphs) {
    if (paragraph.length > MAX_CHUNK_LENGTH) {
      flushCurrentChunk();
      chunks.push(...splitLongParagraph(paragraph));
      continue;
    }

    if (currentChunkParts.length === 0) {
      currentChunkParts = [paragraph];
      currentChunkLength = paragraph.length;
      continue;
    }

    const nextChunkLength = currentChunkLength + 2 + paragraph.length;

    if (nextChunkLength <= MAX_CHUNK_LENGTH) {
      currentChunkParts.push(paragraph);
      currentChunkLength = nextChunkLength;
      continue;
    }

    flushCurrentChunk();
    currentChunkParts = [paragraph];
    currentChunkLength = paragraph.length;
  }

  flushCurrentChunk();

  return chunks;
}
