import { $isElementNode, type LexicalNode } from "lexical";
import type { Nodes, Table, TableCell } from "mdast";
import { parseMarkdownSource } from "./markdown-ast";

export const markdownSourceTables = (source: string) => {
  const tables: Table[] = [];
  const stack: Nodes[] = [...parseMarkdownSource(source).children].reverse();
  while (stack.length) {
    const node = stack.pop()!;
    if (node.type === "table") tables.push(node);
    else if ("children" in node) stack.push(...[...node.children].reverse());
  }
  return tables;
};

export const markdownCellSourcePositions = (cell: TableCell) => {
  const offsets: number[] = [];
  const stack: Nodes[] = [...cell.children].reverse();
  while (stack.length) {
    const node = stack.pop()!;
    if ("children" in node) stack.push(...[...node.children].reverse());
    else if (node.position?.start.offset !== undefined && node.position.end.offset !== undefined) {
      offsets.push(node.position.start.offset, Math.max(node.position.start.offset, node.position.end.offset - 1));
    }
  }
  return offsets;
};

export const markdownTableAlignmentCells = (source: string, table: Table) => {
  const start = source.indexOf("\n", table.children[0]!.position!.end.offset!) + 1;
  const newline = source.indexOf("\n", start);
  const end = newline < 0 ? source.length : newline;
  return [...source.slice(start, end).matchAll(/:?-+:?/g)].map((match) => ({
    position: { start: { offset: start + match.index }, end: { offset: start + match.index + match[0].length } },
  }));
};

export const markdownTableNodeKeys = (nodes: LexicalNode[]) => {
  const keys: string[] = [];
  const stack = [...nodes].reverse();
  while (stack.length) {
    const node = stack.pop()!;
    if (node.getType() === "data_table") keys.push(node.getKey());
    else if ($isElementNode(node)) stack.push(...node.getChildren().reverse());
  }
  return keys;
};
