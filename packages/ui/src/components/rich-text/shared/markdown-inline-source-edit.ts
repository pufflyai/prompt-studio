import type { parseMarkdownSource } from "./markdown-ast";
import { inlineMathRanges } from "./markdown-legacy-math";

interface SourceEdit {
  start: number;
  end: number;
  replacement: string;
}

const wholeInlineMath = (markdown: string, parse: typeof parseMarkdownSource) => {
  // The surrounding prose keeps a bracket formula in its inline context.
  const prefix = "Text ";
  const ranges = inlineMathRanges(parse(`${prefix}${markdown} text`));
  const range = ranges[0];
  if (ranges.length === 1 && range?.start === prefix.length && range.end === prefix.length + markdown.length) {
    return range.value;
  }
};

const replaceExpression = (loaded: string, previous: string, next: string) => {
  const fence = loaded.match(/^\$+|^\\[([]/)?.[0];
  if (!fence) return undefined;
  const bodyEnd = loaded.length - fence.length;
  const offset = loaded.slice(fence.length, bodyEnd).indexOf(previous);
  if (offset < 0) return undefined;
  const start = fence.length + offset;
  return loaded.slice(0, start) + next + loaded.slice(start + previous.length);
};

export const materializeInlineMathEdit = (
  source: string,
  { start, end, replacement }: SourceEdit,
  previous: string | undefined,
  parse: typeof parseMarkdownSource,
) => {
  if (previous !== undefined && replacement) {
    const next = wholeInlineMath(replacement, parse);
    if (next !== undefined) {
      const candidate = replaceExpression(source.slice(start, end), previous, next);
      if (candidate !== undefined && wholeInlineMath(candidate, parse) === next) replacement = candidate;
    }
  }

  // Dollar runs merge when an edit joins them. Keep the loaded delimiters on either side intact.
  const leftDollar = source[start - 1] === "$";
  const rightDollar = source[end] === "$";
  if (!replacement) return leftDollar && rightDollar ? " " : "";
  const before = leftDollar && replacement.startsWith("$") ? " " : "";
  const after = rightDollar && replacement.endsWith("$") ? " " : "";
  return before + replacement + after;
};
