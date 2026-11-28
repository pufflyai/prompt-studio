import { diffArrays, diffChars } from "diff";
import type { Table, TableCell } from "mdast";
import { parseMarkdownSource } from "./markdown-ast";
import { materializeInlineMathEdit } from "./markdown-inline-source-edit";
import { inlineMathRanges } from "./markdown-legacy-math";
import { collectMarkdownLinkChanges } from "./markdown-source-links";
import { buildSourceMap, mappedEnd, mappedInsertion, mappedStart, type SourceMap } from "./markdown-source-map";

interface TextEdit {
  containsMath?: boolean;
  previousMath?: string;
  end: number;
  replacement: string;
  start: number;
}

interface TableChanges {
  edits: TextEdit[];
  normalizedCurrent: string;
}

const editsFromChanges = (changes: ReturnType<typeof diffChars>) => {
  const edits: TextEdit[] = [];
  let baselineOffset = 0;
  let pending: TextEdit | null = null;

  const finishPending = () => {
    if (!pending) return;
    edits.push(pending);
    pending = null;
  };

  for (const change of changes) {
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

type MathDiffToken = string | { value: string; source: string; offset: number };

const mathDiffTokens = (markdown: string, ranges: ReturnType<typeof inlineMathRanges>) => {
  const tokens: MathDiffToken[] = [];
  let offset = 0;
  for (const { start, end, value } of ranges) {
    for (const character of markdown.slice(offset, start)) tokens.push(character);
    tokens.push({ value, source: markdown.slice(start, end), offset: start });
    offset = end;
  }
  for (const character of markdown.slice(offset)) tokens.push(character);
  return tokens;
};

const tokenSource = (token: MathDiffToken) => (typeof token === "string" ? token : token.source);

const isWholeLine = (markdown: string, start: number, end: number) => {
  const lineStart = markdown.lastIndexOf("\n", start - 1) + 1;
  const lineEnd = markdown.indexOf("\n", end);
  return (
    /^ {0,3}$/.test(markdown.slice(lineStart, start)) &&
    /^\s*$/.test(markdown.slice(end, lineEnd < 0 ? undefined : lineEnd))
  );
};

const collectEdits = (
  baseline: string,
  current: string,
  source: string,
  sourceMap: SourceMap,
  parse: typeof parseMarkdownSource,
) => {
  const markers = /\$|\\[([]/;
  if (!markers.test(baseline) && !markers.test(current)) return editsFromChanges(diffChars(baseline, current));

  const before = inlineMathRanges(parse(baseline));
  const after = inlineMathRanges(parse(current));
  if (!before.length && !after.length) return editsFromChanges(diffChars(baseline, current));

  // Keep unchanged equations whole even when adjacent equations require a different delimiter spelling.
  const original = mathDiffTokens(baseline, before);
  const bracketOffsets = new Set(
    before.filter(({ start }) => source.startsWith("\\[", mappedStart(sourceMap, start))).map(({ start }) => start),
  );
  const standaloneOffsets = new Set(
    after.filter(({ start, end }) => isWholeLine(current, start, end)).map(({ start }) => start),
  );
  const changes = diffArrays(original, mathDiffTokens(current, after), {
    comparator: (left, right) => {
      if (typeof left === "string" || typeof right === "string") return left === right;
      // Preserving square brackets on a whole line would promote this inline equation to display math.
      return left.value === right.value && !(bracketOffsets.has(left.offset) && standaloneOffsets.has(right.offset));
    },
  });
  let offset = 0;
  const edits = editsFromChanges(
    changes.map((change) => {
      if (change.added) return { ...change, value: change.value.map(tokenSource).join("") };
      const value = original
        .slice(offset, offset + change.count)
        .map(tokenSource)
        .join("");
      offset += change.count;
      return { ...change, value };
    }),
  );

  return edits.map((edit) => {
    const touched = before.find(({ start, end }) => start < edit.end && end > edit.start);
    const joinsMath = before.some(({ end }) => end === edit.start) && before.some(({ start }) => start === edit.end);
    const containsMath =
      touched !== undefined ||
      joinsMath ||
      (markers.test(edit.replacement) && inlineMathRanges(parse(edit.replacement)).length > 0);
    const previousMath = touched?.start === edit.start && touched.end === edit.end ? touched.value : undefined;
    return { ...edit, containsMath, previousMath };
  });
};

const sourceLineEnding = (source: string) => (source.includes("\r\n") ? "\r\n" : "\n");

const withSourceLineEndings = (value: string, source: string) => {
  const lineEnding = sourceLineEnding(source);
  return lineEnding === "\n" ? value : value.replace(/\r?\n/g, lineEnding);
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

const tablesIn = (markdown: string, parse: typeof parseMarkdownSource) =>
  parse(markdown).children.filter((node): node is Table => node.type === "table" && Boolean(node.position));

const tableCells = (table: Table) => table.children.flatMap((row) => row.children);

const sameTableShape = (left: Table, right: Table) =>
  left.children.length === right.children.length &&
  left.children.every((row, index) => row.children.length === right.children[index]?.children.length);

const nodeOffsets = (node: { position?: { start: { offset?: number }; end: { offset?: number } } }) => {
  const start = node.position?.start.offset;
  const end = node.position?.end.offset;
  return start === undefined || end === undefined ? null : { end, start };
};

export const cellContentOffsets = (markdown: string, cell: TableCell) => {
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

const collectTableChanges = (
  source: string,
  baseline: string,
  current: string,
  parse: typeof parseMarkdownSource,
): TableChanges => {
  const sourceTables = tablesIn(source, parse);
  const baselineTables = tablesIn(baseline, parse);
  const currentTables = tablesIn(current, parse);

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

export const applyMarkdownSourceChanges = (
  source: string,
  baseline: string,
  current: string,
  sourceMap?: SourceMap,
  parse = parseMarkdownSource,
) => {
  if (baseline === current) return source;

  const sourceMapping = sourceMap ?? buildSourceMap(baseline, source, parse);
  const linkChanges = collectMarkdownLinkChanges(source, baseline, current, parse);
  const tableChanges = collectTableChanges(source, baseline, linkChanges.normalizedCurrent, parse);

  // Lexical reports semantic Markdown but normalizes its spelling. Map those
  // semantic edits back onto the loaded source so unrelated syntax never moves.
  const edits = collectEdits(baseline, tableChanges.normalizedCurrent, source, sourceMapping, parse)
    .map((edit) => {
      const start =
        edit.start === edit.end ? mappedInsertion(sourceMapping, edit.start) : mappedStart(sourceMapping, edit.start);
      const end = edit.start === edit.end ? start : mappedEnd(sourceMapping, edit.end);
      const replacement = edit.containsMath
        ? materializeInlineMathEdit(source, { start, end, replacement: edit.replacement }, edit.previousMath, parse)
        : edit.replacement;
      return { start, end, replacement: withSourceLineEndings(replacement, source) };
    })
    .concat(
      linkChanges.edits.map((edit) => ({
        ...edit,
        replacement: withSourceLineEndings(edit.replacement, source),
      })),
    )
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
