import { diffChars } from "diff";
import * as Y from "yjs";
import { splitFrontmatter } from "../utils/markdown";
import { applyMarkdownSourceChanges, cellContentOffsets } from "./markdown-source-edits";
import { markdownSourceTables } from "./markdown-table-source-positions";
import type { createMarkdownTextDocument } from "./markdown-text-document";

interface TableDraftInput {
  binding: ReturnType<typeof createMarkdownTextDocument>;
  tableIndex: number;
  rowIndex: number;
  columnIndex: number;
  value: string;
}

const tableCellSource = (source: string) => {
  let result = "";
  let slashes = 0;
  for (let index = 0; index < source.length; index++) {
    const character = source[index]!;
    if (character === "\r" || character === "\n") {
      if (character === "\r" && source[index + 1] === "\n") index++;
      if (slashes % 2) result = result.slice(0, -1);
      else result = result.replace(/ {2,}$/, "");
      result += "<br>";
      slashes = 0;
      continue;
    }
    // GFM reads unescaped pipes as column boundaries, including inside inline code.
    if (character === "|" && slashes % 2 === 0) result += "\\";
    result += character;
    slashes = character === "\\" ? slashes + 1 : 0;
  }
  return result;
};

/** Save only this draft's original character operations, preserving unseen peer changes. */
export const createMarkdownTableDraft = (input: TableDraftInput) => {
  const { binding, value } = input;
  const original = binding.text.toString();
  const { body, frontmatter } = splitFrontmatter(original);
  const cell = markdownSourceTables(body)[input.tableIndex]?.children[input.rowIndex]?.children[input.columnIndex];
  const offsets = cell && cellContentOffsets(body, cell);
  if (!offsets) throw new Error("The Markdown table cell is unavailable");
  const loaded = body.slice(offsets.start, offsets.end);
  const start = frontmatter.length + offsets.start;
  const suffixLength = original.length - (frontmatter.length + offsets.end);
  const document = new Y.Doc({ gc: false });
  Y.applyUpdate(document, Y.encodeStateAsUpdate(binding.text.doc!));
  return {
    commit(draft: string) {
      const text = document.getText("content");
      const current = text.toString().slice(start, text.length - suffixLength);
      const next = tableCellSource(applyMarkdownSourceChanges(loaded, value, draft));
      document.transact(() => {
        let index = start;
        for (const change of diffChars(current, next)) {
          if (change.removed) text.delete(index, change.value.length);
          else {
            if (change.added) text.insert(index, change.value);
            index += change.value.length;
          }
        }
      });
      binding.applyLocalUpdate(Y.encodeStateAsUpdate(document, Y.encodeStateVector(binding.text.doc!)));
    },
    dispose() {
      document.destroy();
    },
  };
};
