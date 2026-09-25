// Legal text must stay reviewable line by line. These rules keep each sentence on
// its own markdown line, prove the served page renders it, and catch copies of the
// text in code, which would fork the source of truth.

// A sentence ends, then more text follows on the same line.
const SENTENCE_BREAK = /[.!?]["'”’)\]*_]*\s+\S/;

// Shorter lines, such as headings and link labels, legitimately appear in code.
const MIN_COPY_LENGTH = 40;

const normalize = (text: string) =>
  text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/\s+/g, " ")
    .trim();

const plainLine = (line: string) =>
  normalize(
    line
      .replace(/^\s*(#{1,6}\s+|[-*+]\s+|>\s+)/, "")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/\*\*|__/g, "")
      .replace(/(^|\W)[*_]([^*_]+)[*_](?=\W|$)/g, "$1$2"),
  );

const markdownSentences = (markdown: string) => markdown.split("\n").map(plainLine).filter(Boolean);

const decodeEntities = (text: string) =>
  text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal: string) => String.fromCodePoint(Number(decimal)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");

// Only rendered text counts. Scripts and serialized island props do not.
const visibleText = (html: string) =>
  normalize(decodeEntities(html.replace(/<(script|style|head)\b[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]*>/g, "")));

export const linesWithSeveralSentences = (markdown: string) =>
  markdown.split("\n").flatMap((line, index) => (SENTENCE_BREAK.test(line.trim()) ? [index + 1] : []));

export const missingSentences = (markdown: string, html: string) => {
  const text = visibleText(html);
  return markdownSentences(markdown).filter((sentence) => !text.includes(sentence));
};

export const filesWithCopiedText = (markdown: string, sources: Record<string, string>) => {
  const sentences = markdownSentences(markdown).filter((sentence) => sentence.length >= MIN_COPY_LENGTH);
  return Object.entries(sources)
    .filter(([, content]) => {
      const text = normalize(content);
      return sentences.some((sentence) => text.includes(sentence));
    })
    .map(([path]) => path);
};
