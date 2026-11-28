import { diffArrays, diffChars } from "diff";
import { parseMarkdownSource } from "./markdown-ast";
import { inlineMathRanges } from "./markdown-legacy-math";

export interface SourceMap {
  blockStarts: Map<number, number>;
  end: number[];
  start: number[];
}

const matchingSourceBlocks = (canonical: string, source: string, parse: typeof parseMarkdownSource) => {
  const canonicalBlocks = parse(canonical).children;
  // Link definitions remain in the source but have no editable Lexical block.
  const sourceBlocks = parse(source).children.filter((block) => block.type !== "definition");
  const sameBlocks =
    canonicalBlocks.length === sourceBlocks.length &&
    canonicalBlocks.every(
      (block, index) =>
        block.type === sourceBlocks[index]?.type &&
        block.position?.start.offset !== undefined &&
        sourceBlocks[index]?.position?.start.offset !== undefined &&
        block.position?.end.offset !== undefined &&
        sourceBlocks[index]?.position?.end.offset !== undefined,
    );

  return sameBlocks ? canonicalBlocks.map((block, index) => ({ canonical: block, source: sourceBlocks[index]! })) : [];
};

function* diffSourceBlocks(canonical: string, source: string, blocks: ReturnType<typeof matchingSourceBlocks>) {
  if (!blocks.length) {
    yield* diffChars(canonical, source);
    return;
  }

  // Import preserves block order. Match spelling within those blocks so many
  // normalized tokens do not create one quadratic diff across the document.
  let canonicalOffset = 0;
  let sourceOffset = 0;
  for (const block of blocks) {
    const canonicalEnd = block.canonical.position!.end.offset!;
    const sourceEnd = block.source.position!.end.offset!;
    yield* diffChars(canonical.slice(canonicalOffset, canonicalEnd), source.slice(sourceOffset, sourceEnd));
    canonicalOffset = canonicalEnd;
    sourceOffset = sourceEnd;
  }
  yield* diffChars(canonical.slice(canonicalOffset), source.slice(sourceOffset));
}

const mapInlineMathBoundaries = (
  canonical: string,
  source: string,
  map: SourceMap,
  parse: typeof parseMarkdownSource,
) => {
  if (!/\$|\\[([]/.test(canonical)) return;
  const before = inlineMathRanges(parse(canonical));
  if (!before.length) return;
  const after = inlineMathRanges(parse(source));
  const matches = diffArrays(before, after, { comparator: (left, right) => left.value === right.value });
  let canonicalIndex = 0;
  let sourceIndex = 0;
  let previousEnd: number | undefined;
  for (const match of matches) {
    if (!match.added && !match.removed) {
      for (let index = 0; index < match.count; index++) {
        const original = before[canonicalIndex + index]!;
        const loaded = after[sourceIndex + index]!;
        map.start[original.start] = loaded.start;
        // At a shared boundary, the left and right spellings can enclose source-only text.
        if (original.start !== previousEnd) map.end[original.start] = loaded.start;
        map.start[original.end] = map.end[original.end] = loaded.end;
        previousEnd = original.end;
      }
    }
    if (!match.added) canonicalIndex += match.count;
    if (!match.removed) sourceIndex += match.count;
  }
};

export const buildSourceMap = (canonical: string, source: string, parse = parseMarkdownSource) => {
  // Most caret spans are unchanged text. Their offsets already match, including block boundaries.
  if (canonical === source) {
    const start = Array.from({ length: canonical.length + 1 }, (_, index) => index);
    return { blockStarts: new Map<number, number>(), start, end: [...start] } satisfies SourceMap;
  }

  const start = Array.from<number>({ length: canonical.length + 1 }).fill(-1);
  const end = Array.from<number>({ length: canonical.length + 1 }).fill(-1);
  let canonicalOffset = 0;
  let sourceOffset = 0;
  let removedAtBoundary = false;
  const blocks = matchingSourceBlocks(canonical, source, parse);

  start[0] = 0;
  end[0] = 0;

  for (const change of diffSourceBlocks(canonical, source, blocks)) {
    const length = change.value.length;

    if (change.added) {
      end[canonicalOffset] = sourceOffset;
      sourceOffset += length;
      start[canonicalOffset] = sourceOffset;
      if (removedAtBoundary) end[canonicalOffset] = sourceOffset;
      removedAtBoundary = false;
      continue;
    }

    if (change.removed) {
      for (let index = 0; index <= length; index += 1) {
        start[canonicalOffset + index] = sourceOffset;
        end[canonicalOffset + index] = sourceOffset;
      }
      canonicalOffset += length;
      removedAtBoundary = true;
      continue;
    }

    for (let index = 0; index <= length; index += 1) {
      const offset = canonicalOffset + index;
      start[offset] = sourceOffset + index;
      // A source-only insertion at this boundary belongs between the
      // canonical characters. Keep its left edge as the end of the preceding
      // range so an edit before it does not consume untouched source.
      if (end[offset] === undefined || end[offset] < 0) end[offset] = sourceOffset + index;
    }
    canonicalOffset += length;
    sourceOffset += length;
    removedAtBoundary = false;
  }

  // Block prefixes belong after preserved separators. A character diff can
  // otherwise place a new heading marker inside extra source-only blank lines.
  const blockStarts = new Map<number, number>();
  for (const block of blocks) {
    const canonicalStart = block.canonical.position!.start.offset!;
    const sourceStart = block.source.position!.start.offset!;
    blockStarts.set(canonicalStart, sourceStart);
  }

  const map = { blockStarts, end, start } satisfies SourceMap;
  mapInlineMathBoundaries(canonical, source, map, parse);
  return map;
};

const nearestMappedOffset = (values: number[], index: number, direction: -1 | 1) => {
  for (let offset = index; offset >= 0 && offset < values.length; offset += direction) {
    const value = values[offset];
    if (value !== undefined && value >= 0) return value;
  }
  return direction === -1 ? 0 : (values.at(-1) ?? 0);
};

export const mappedStart = (map: SourceMap, index: number) => {
  const exact = map.start[index];
  if (exact !== undefined && exact >= 0) return exact;
  return nearestMappedOffset(map.start, index, -1);
};

export const mappedEnd = (map: SourceMap, index: number) => {
  const exact = map.end[index];
  if (exact !== undefined && exact >= 0) return exact;
  return nearestMappedOffset(map.end, index, 1);
};

export const mappedInsertion = (map: SourceMap, index: number) => map.blockStarts.get(index) ?? mappedEnd(map, index);
