import { $getNodeByKey, $isElementNode, type ElementNode, type LexicalNode } from "lexical";
import * as Y from "yjs";
import {
  markdownTableAlignmentCells as alignmentCells,
  markdownCellSourcePositions as cellPositions,
  markdownSourceTables as sourceTables,
} from "./markdown-table-source-positions";
import { $isDataTableNode, type DataTableNode } from "./nodes/DataTableNode";

export const markdownTableNodes = (nodes: LexicalNode[]) => {
  const tables: DataTableNode[] = [];
  const stack = [...nodes].reverse();
  while (stack.length) {
    const node = stack.pop()!;
    if ($isDataTableNode(node)) tables.push(node);
    else if ($isElementNode(node)) stack.push(...node.getChildren().reverse());
  }
  return tables;
};

type Anchors = Y.RelativePosition[];
type SourceRange = { position?: { start: { offset?: number }; end: { offset?: number } } };

const containingRange = (ranges: SourceRange[], offset: number) => {
  let left = 0;
  let right = ranges.length;
  while (left < right) {
    const middle = Math.floor((left + right) / 2);
    if ((ranges[middle]!.position?.start.offset ?? Infinity) <= offset) left = middle + 1;
    else right = middle;
  }
  const index = left - 1;
  return index >= 0 && offset < (ranges[index]!.position?.end.offset ?? -1) ? index : -1;
};

const matchAnchors = (anchors: Anchors, ranges: SourceRange[], text: Y.Text, prefix: number) => {
  const votes = new Map<number, number>();
  for (const anchor of anchors) {
    const absolute = Y.createAbsolutePositionFromRelativePosition(anchor, text.doc!);
    if (!absolute || absolute.type !== text || !anchor.item) continue;
    const current = Y.createRelativePositionFromTypeIndex(text, absolute.index).item;
    // A deleted row's anchor may resolve beside another row; that is not the same row.
    if (!Y.compareIDs(current, anchor.item)) continue;
    const offset = absolute.index - prefix;
    const index = containingRange(ranges, offset);
    if (index >= 0) votes.set(index, (votes.get(index) ?? 0) + 1);
  }
  return [...votes].sort((left, right) => right[1] - left[1])[0];
};

const assignIdentities = (
  count: number,
  matches: Array<{ id: string; index: number; confidence: number; votes: number }>,
  kind: string,
) => {
  const ids = Array.from({ length: count }, () => `${kind}-${crypto.randomUUID()}`);
  const assigned = new Set<number>();
  for (const match of matches.sort((left, right) => right.confidence - left.confidence || right.votes - left.votes)) {
    if (assigned.has(match.index)) continue;
    assigned.add(match.index);
    ids[match.index] = match.id;
  }
  return ids;
};

const structuralPositions = (source: string, range: SourceRange) => {
  const start = range.position?.start.offset;
  const end = range.position?.end.offset;
  if (start === undefined || end === undefined) return [];
  return [start, ...[...source.slice(start, end).matchAll(/\|/g)].map((match) => start + match.index)];
};

export const captureMarkdownTables = (root: ElementNode, source: string, document: { readonly text: Y.Text }) => {
  const text = document.text;
  const prefix = text.length - source.length;
  const nodes = markdownTableNodes(root.getChildren());
  const anchor = (offsets: number[]) =>
    offsets.map((offset) => Y.createRelativePositionFromTypeIndex(text, prefix + offset));
  const captured = (nodes.length ? sourceTables(source) : []).flatMap((table, index) => {
    const node = nodes[index];
    if (!node) return [];
    const value = node.getTable();
    const header = table.children[0]!;
    const alignment = alignmentCells(source, table);
    const contents = table.children.flatMap((row) => row.children.flatMap(cellPositions));
    return [
      {
        key: node.getKey(),
        contents: anchor(contents),
        start: anchor([...structuralPositions(source, header), ...alignment.map((cell) => cell.position.start.offset)]),
        columns: value.columns.map((column, index) => ({
          id: column.id,
          contents: anchor(header.children[index] ? cellPositions(header.children[index]!) : []),
          alignment: anchor(alignment[index] ? [source.indexOf("-", alignment[index]!.position.start.offset)] : []),
        })),
        rows: value.rows.map((row, index) => ({
          id: row.id,
          contents: anchor(table.children[index + 1]?.children.flatMap(cellPositions) ?? []),
          start: anchor(table.children[index + 1] ? structuralPositions(source, table.children[index + 1]!) : []),
        })),
      },
    ];
  });
  return {
    restore(next: LexicalNode[], nextSource: string) {
      if (!captured.length) return new Map<string, DataTableNode>();
      const text = document.text;
      const prefix = text.length - nextSource.length;
      const tables = sourceTables(nextSource);
      const nodes = markdownTableNodes(next);
      const preserved = new Map<string, DataTableNode>();
      for (const previous of captured) {
        const match =
          matchAnchors(previous.contents, tables, text, prefix) ?? matchAnchors(previous.start, tables, text, prefix);
        if (!match) continue;
        const index = match[0];
        const old = $getNodeByKey(previous.key);
        const nextNode = nodes[index];
        if (!$isDataTableNode(old) || !nextNode || [...preserved.values()].includes(old)) continue;
        const table = tables[index]!;
        const value = nextNode.getTable();
        const alignment = alignmentCells(nextSource, table);
        const columns = previous.columns.flatMap((column) => {
          const strong = matchAnchors(column.contents, table.children[0]!.children, text, prefix);
          const match = strong ?? matchAnchors(column.alignment, alignment, text, prefix);
          return match ? [{ id: column.id, index: match[0], confidence: strong ? 2 : 1, votes: match[1] }] : [];
        });
        const rows = previous.rows.flatMap((row) => {
          const ranges = table.children.slice(1);
          const strong = matchAnchors(row.contents, ranges, text, prefix);
          const match = strong ?? matchAnchors(row.start, ranges, text, prefix);
          return match ? [{ id: row.id, index: match[0], confidence: strong ? 2 : 1, votes: match[1] }] : [];
        });
        const columnIds = assignIdentities(value.columns.length, columns, "column");
        const rowIds = assignIdentities(value.rows.length, rows, "row");
        const projected = {
          columns: value.columns.map((column, index) => ({ ...column, id: columnIds[index]! })),
          rows: value.rows.map((row, index) => ({
            id: rowIds[index]!,
            cells: Object.fromEntries(
              value.columns.map((column, index) => [columnIds[index]!, row.cells[column.id] ?? ""]),
            ),
          })),
        };
        if (JSON.stringify(old.getTable()) !== JSON.stringify(projected)) old.setTable(projected);
        preserved.set(nextNode.getKey(), old);
      }
      return preserved;
    },
  };
};

export type MarkdownTableProjection = ReturnType<typeof captureMarkdownTables>;
