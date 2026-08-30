import { diffChars } from "diff";
import { $getRoot, type ElementNode } from "lexical";
import type { Table, TableCell } from "mdast";
import { parseMarkdownSource } from "./markdown-ast";
import { exportLexicalToMarkdown } from "./markdown-export";
import { importMarkdownToLexical } from "./markdown-import";
import type { MarkdownUrlResolver } from "./markdown-url";

interface SourceMap {
  end: number[];
  start: number[];
}

interface TextEdit {
  end: number;
  replacement: string;
  start: number;
}

interface TableChanges {
  edits: TextEdit[];
  normalizedCurrent: string;
}

const buildSourceMap = (canonical: string, source: string) => {
  const start = Array.from<number>({ length: canonical.length + 1 }).fill(-1);
  const end = Array.from<number>({ length: canonical.length + 1 }).fill(-1);
  let canonicalOffset = 0;
  let sourceOffset = 0;
  let removedAtBoundary = false;

  start[0] = 0;
  end[0] = 0;

  for (const change of diffChars(canonical, source)) {
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

const collectEdits = (baseline: string, current: string) => {
  const edits: TextEdit[] = [];
  let baselineOffset = 0;
  let pending: TextEdit | null = null;

  const finishPending = () => {
    if (!pending) return;
    edits.push(pending);
    pending = null;
  };

  for (const change of diffChars(baseline, current)) {
    if (!change.added && !change.removed) {
      finishPending();
      baselineOffset += change.value.length;
      continue;
    }

    pending ??= { start: baselineOffset, end: baselineOffset, replacement: "" };
    if (change.added) {
      pending.replacement += change.value;
      continue;
    }

    baselineOffset += change.value.length;
    pending.end = baselineOffset;
  }

  finishPending();
  return edits;
};

const nearestMappedOffset = (values: number[], index: number, direction: -1 | 1) => {
  for (let offset = index; offset >= 0 && offset < values.length; offset += direction) {
    const value = values[offset];
    if (value !== undefined && value >= 0) return value;
  }
  return direction === -1 ? 0 : (values.at(-1) ?? 0);
};

const mappedStart = (map: SourceMap, index: number) => {
  const exact = map.start[index];
  if (exact !== undefined && exact >= 0) return exact;
  return nearestMappedOffset(map.start, index, -1);
};

const mappedEnd = (map: SourceMap, index: number) => {
  const exact = map.end[index];
  if (exact !== undefined && exact >= 0) return exact;
  return nearestMappedOffset(map.end, index, 1);
};

const sourceLineEnding = (source: string) => (source.includes("\r\n") ? "\r\n" : "\n");

const withSourceLineEndings = (value: string, source: string) => {
  const lineEnding = sourceLineEnding(source);
  return lineEnding === "\n" ? value : value.replaceAll("\n", lineEnding);
};

const withoutPosition = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(withoutPosition);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== "position")
      .map(([key, entry]) => [key, withoutPosition(entry)]),
  );
};

const sameMarkdownNode = (left: unknown, right: unknown) =>
  JSON.stringify(withoutPosition(left)) === JSON.stringify(withoutPosition(right));

const tablesIn = (markdown: string) =>
  parseMarkdownSource(markdown).children.filter(
    (node): node is Table => node.type === "table" && Boolean(node.position),
  );

const tableCells = (table: Table) => table.children.flatMap((row) => row.children);

const sameTableShape = (left: Table, right: Table) =>
  left.children.length === right.children.length &&
  left.children.every((row, index) => row.children.length === right.children[index]?.children.length);

const nodeOffsets = (node: { position?: { start: { offset?: number }; end: { offset?: number } } }) => {
  const start = node.position?.start.offset;
  const end = node.position?.end.offset;
  return start === undefined || end === undefined ? null : { end, start };
};

const cellContentOffsets = (markdown: string, cell: TableCell) => {
  const first = cell.children[0];
  const last = cell.children.at(-1);
  const contentStart = first?.position?.start.offset;
  const contentEnd = last?.position?.end.offset;

  if (contentStart !== undefined && contentEnd !== undefined) {
    return { start: contentStart, end: contentEnd };
  }

  const cellOffsets = nodeOffsets(cell);
  if (!cellOffsets) return null;
  const cellSource = markdown.slice(cellOffsets.start, cellOffsets.end);
  const leftDelimiter = cellSource.indexOf("|");
  const rightDelimiter = cellSource.endsWith("|") ? cellSource.length - 1 : cellSource.length;
  const insideStart = leftDelimiter < 0 ? 0 : leftDelimiter + 1;
  const leadingSpace = cellSource.slice(insideStart, rightDelimiter).match(/^\s*/)?.[0].length ?? 0;
  const offset = cellOffsets.start + insideStart + leadingSpace;
  return { start: offset, end: offset };
};

const cellMarkdown = (markdown: string, cell: TableCell) => {
  const offsets = cellContentOffsets(markdown, cell);
  return offsets ? markdown.slice(offsets.start, offsets.end) : "";
};

const collectTableCellEdits = (
  source: string,
  current: string,
  sourceTable: Table,
  baselineTable: Table,
  currentTable: Table,
) => {
  const sourceCells = tableCells(sourceTable);
  const baselineCells = tableCells(baselineTable);
  const currentCells = tableCells(currentTable);

  return currentCells.flatMap((currentCell, index) => {
    const sourceCell = sourceCells[index];
    const baselineCell = baselineCells[index];
    if (!sourceCell || !baselineCell || sameMarkdownNode(baselineCell, currentCell)) return [];

    const sourceContent = cellContentOffsets(source, sourceCell);
    if (!sourceContent) return [];
    return [{ ...sourceContent, replacement: cellMarkdown(current, currentCell) }];
  });
};

const editsForTable = (
  source: string,
  current: string,
  sourceTable: Table,
  baselineTable: Table,
  currentTable: Table,
) => {
  if (sameMarkdownNode(baselineTable, currentTable)) return [];

  const cellOnlyChange =
    sameTableShape(baselineTable, currentTable) &&
    sameTableShape(sourceTable, baselineTable) &&
    JSON.stringify(baselineTable.align) === JSON.stringify(currentTable.align);

  if (cellOnlyChange) {
    return collectTableCellEdits(source, current, sourceTable, baselineTable, currentTable);
  }

  const sourceOffsets = nodeOffsets(sourceTable);
  const currentOffsets = nodeOffsets(currentTable);
  if (!sourceOffsets || !currentOffsets) return [];
  return [
    {
      start: sourceOffsets.start,
      end: sourceOffsets.end,
      replacement: current.slice(currentOffsets.start, currentOffsets.end),
    },
  ];
};

const collectTableChanges = (source: string, baseline: string, current: string): TableChanges => {
  const sourceTables = tablesIn(source);
  const baselineTables = tablesIn(baseline);
  const currentTables = tablesIn(current);

  if (sourceTables.length !== baselineTables.length || baselineTables.length !== currentTables.length) {
    return { edits: [], normalizedCurrent: current };
  }

  const edits: TextEdit[] = [];
  let normalizedCurrent = current;

  for (let index = currentTables.length - 1; index >= 0; index -= 1) {
    const sourceTable = sourceTables[index];
    const baselineTable = baselineTables[index];
    const currentTable = currentTables[index];
    if (!sourceTable || !baselineTable || !currentTable) continue;

    const baselineOffsets = nodeOffsets(baselineTable);
    const currentOffsets = nodeOffsets(currentTable);
    if (!baselineOffsets || !currentOffsets) continue;

    normalizedCurrent =
      normalizedCurrent.slice(0, currentOffsets.start) +
      baseline.slice(baselineOffsets.start, baselineOffsets.end) +
      normalizedCurrent.slice(currentOffsets.end);

    edits.push(...editsForTable(source, current, sourceTable, baselineTable, currentTable));
  }

  return { edits, normalizedCurrent };
};

const applyChanges = (source: string, sourceMap: SourceMap, baseline: string, current: string) => {
  if (baseline === current) return source;

  const tableChanges = collectTableChanges(source, baseline, current);

  // Lexical reports semantic Markdown but normalizes its spelling. Map those
  // semantic edits back onto the loaded source so unrelated syntax never moves.
  const edits = collectEdits(baseline, tableChanges.normalizedCurrent)
    .map((edit) => ({
      start: edit.start === edit.end ? mappedEnd(sourceMap, edit.start) : mappedStart(sourceMap, edit.start),
      end: mappedEnd(sourceMap, edit.end),
      replacement: withSourceLineEndings(edit.replacement, source),
    }))
    .concat(
      tableChanges.edits.map((edit) => ({
        ...edit,
        replacement: withSourceLineEndings(edit.replacement, source),
      })),
    )
    .sort((left, right) => right.start - left.start);

  let result = source;
  for (const edit of edits) {
    result = result.slice(0, edit.start) + edit.replacement + result.slice(edit.end);
  }
  return result;
};

export interface MarkdownSourceDocument {
  exportFromLexical: (root: ElementNode) => string;
  importToLexical: () => void;
}

export const createMarkdownSourceDocument = (
  source: string,
  resolver?: MarkdownUrlResolver,
): MarkdownSourceDocument => {
  let baseline: string | null = null;
  let sourceMap: SourceMap | null = null;

  return {
    importToLexical() {
      importMarkdownToLexical(source, resolver);
      baseline = exportLexicalToMarkdown($getRoot());
      sourceMap = buildSourceMap(baseline, source);
    },
    exportFromLexical(root) {
      const current = exportLexicalToMarkdown(root);
      const loadedBaseline = baseline ?? current;
      return applyChanges(source, sourceMap ?? buildSourceMap(loadedBaseline, source), loadedBaseline, current);
    },
  };
};
