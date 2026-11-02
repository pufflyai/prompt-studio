import { diffChars } from "diff";
import * as Y from "yjs";
import { splitFrontmatter } from "../utils/markdown";
import type { MarkdownDocumentBinding } from "./markdown-document-context";
import { applyMarkdownSourceChanges, cellContentOffsets } from "./markdown-source-edits";
import { markdownSourceTables } from "./markdown-table-source-positions";

interface TableDraftInput {
  binding: MarkdownDocumentBinding;
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
  const transaction = "createDraft" in binding ? binding.createDraft() : undefined;
  let owned = transaction;
  const original = transaction?.text.toString() ?? binding.text.toString();
  const { body, frontmatter } = splitFrontmatter(original);
  const cell = markdownSourceTables(body)[input.tableIndex]?.children[input.rowIndex]?.children[input.columnIndex];
  const offsets = cell && cellContentOffsets(body, cell);
  if (!offsets) {
    transaction?.cancel();
    throw new Error("The Markdown table cell is unavailable");
  }
  const loaded = body.slice(offsets.start, offsets.end);
  const start = frontmatter.length + offsets.start;
  const suffixLength = original.length - (frontmatter.length + offsets.end);
  const document = transaction?.text.doc ?? new Y.Doc({ gc: false });
  if (!transaction) Y.applyUpdate(document, Y.encodeStateAsUpdate(binding.text.doc!));
  const update = (draft: string) => {
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
  };
  return {
    update,
    commit(draft: string) {
      if (transaction && !owned) return;
      update(draft);
      if (owned) {
        const finishing = owned.commit();
        owned = undefined;
        // Recovery is now owned and displayed by the parent binding, including a failed acknowledgement.
        void finishing.catch(() => {});
      } else binding.applyLocalUpdate(Y.encodeStateAsUpdate(document, Y.encodeStateVector(binding.text.doc!)));
    },
    cancel() {
      if (!transaction) {
        document.destroy();
        return true;
      }
      if (!owned?.cancel()) return false;
      owned = undefined;
      return true;
    },
    dispose() {
      if (!transaction) {
        document.destroy();
        return;
      }
      if (!owned) return;
      // System dismissal (for example read-only withdrawal) must not masquerade as explicit Cancel.
      if (owned.text.toString() === original) owned.cancel();
      else owned.retain();
      owned = undefined;
    },
  };
};
