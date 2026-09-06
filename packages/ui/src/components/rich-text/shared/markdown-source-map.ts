import { diffChars } from "diff";
import { parseMarkdownSource } from "./markdown-ast";

export interface SourceMap {
  end: number[];
  start: number[];
}

function* diffSourceBlocks(canonical: string, source: string) {
  const canonicalBlocks = parseMarkdownSource(canonical).children;
  const sourceBlocks = parseMarkdownSource(source).children;
  const sameBlocks =
    canonicalBlocks.length === sourceBlocks.length &&
    canonicalBlocks.every(
      (block, index) =>
        block.type === sourceBlocks[index]?.type &&
        block.position?.end.offset !== undefined &&
        sourceBlocks[index]?.position?.end.offset !== undefined,
    );

  if (!sameBlocks) {
    yield* diffChars(canonical, source);
    return;
  }

  // Import preserves block order. Match spelling within those blocks so many
  // normalized tokens do not create one quadratic diff across the document.
  let canonicalOffset = 0;
  let sourceOffset = 0;
  for (let index = 0; index < canonicalBlocks.length; index += 1) {
    const canonicalEnd = canonicalBlocks[index]!.position!.end.offset!;
    const sourceEnd = sourceBlocks[index]!.position!.end.offset!;
    yield* diffChars(canonical.slice(canonicalOffset, canonicalEnd), source.slice(sourceOffset, sourceEnd));
    canonicalOffset = canonicalEnd;
    sourceOffset = sourceEnd;
  }
  yield* diffChars(canonical.slice(canonicalOffset), source.slice(sourceOffset));
}

export const buildSourceMap = (canonical: string, source: string) => {
  const start = Array.from<number>({ length: canonical.length + 1 }).fill(-1);
  const end = Array.from<number>({ length: canonical.length + 1 }).fill(-1);
  let canonicalOffset = 0;
  let sourceOffset = 0;
  let removedAtBoundary = false;

  start[0] = 0;
  end[0] = 0;

  for (const change of diffSourceBlocks(canonical, source)) {
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

  return { end, start } satisfies SourceMap;
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
