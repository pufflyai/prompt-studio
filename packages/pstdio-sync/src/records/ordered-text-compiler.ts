import type { Json, SharedEdit, StorageGroup, StorageTextDeclaration } from "pstdio-sync-contracts";
import type { Doc } from "yjs";
import { editTextDocument } from "../text";
import { type applyJsonChanges, jsonPointer, parseJsonPointer, pathsOverlap } from "./ordered-json";
import type { OrderedRecord } from "./ordered-operation";
import { type OrderedTextChange, prepareOrderedText, readOrderedPath } from "./ordered-text";
import { orderedTextLifetime } from "./ordered-text-lifetime";

type TextEdit = Extract<SharedEdit, { kind: "text.insert" | "text.delete" }>;
const applyTextEdits = (document: Doc, edits: TextEdit[]) =>
  editTextDocument(document, (text) => {
    for (const edit of edits) {
      const count = edit.kind === "text.delete" ? edit.count : 0;
      if (
        !Number.isSafeInteger(edit.index) ||
        edit.index < 0 ||
        edit.index > text.length ||
        !Number.isSafeInteger(count) ||
        count < 0 ||
        edit.index + count > text.length
      )
        throw new Error("Text edit is outside the current sequence");
      if (edit.kind === "text.insert") text.insert(edit.index, edit.text);
      else text.delete(edit.index, edit.count);
    }
  });

const fieldPaths = (recordId: string, current: OrderedRecord | undefined, declarations: StorageTextDeclaration[]) => {
  const paths = new Map<string, string[]>();
  for (const declaration of declarations)
    if (recordId.startsWith(declaration.prefix))
      for (const field of declaration.fields) {
        const path = ["value", ...parseJsonPointer(field)];
        paths.set(jsonPointer(path), path);
      }
  for (const key of Object.keys(current?.texts ?? {})) paths.set(key, parseJsonPointer(key));
  return paths;
};

interface TextCompilation {
  edit: StorageGroup["edits"][number];
  current?: OrderedRecord;
  declarations: StorageTextDeclaration[];
  changes: Parameters<typeof applyJsonChanges>[1];
  target: Json;
  sharedText?: string;
}

const compileField = async (input: TextCompilation, pointer: string, path: string[]) => {
  const { edit, current, changes } = input;
  const explicit = path[0] === "value" ? edit.text?.[jsonPointer(path.slice(1))] : undefined;
  const touched = changes.some((change) => pathsOverlap(change.path, path));
  if (!touched && !explicit?.length) return undefined;
  const target = readOrderedPath(input.target, path);
  if (target === undefined && !explicit?.length) return undefined;
  if (typeof target !== "string") {
    if (explicit?.length) throw new Error("A declared text field must contain a string");
    return undefined;
  }
  const saved = current?.texts?.[pointer];
  return prepareOrderedText({
    recordId: edit.recordId,
    lifetime: orderedTextLifetime(current, path),
    path,
    value: current?.value ?? {},
    saved,
    ...(touched ? { replace: target } : {}),
    ...(explicit?.length ? { edit: (document) => applyTextEdits(document, explicit) } : {}),
  });
};

export const compileOrderedText = async (input: TextCompilation) => {
  const { edit, current, changes } = input;
  const paths = fieldPaths(edit.recordId, current, input.declarations);
  if (input.sharedText !== undefined) paths.set("/shared/value", ["shared", "value"]);
  for (const pointer of Object.keys(edit.text ?? {})) {
    const path = ["value", ...parseJsonPointer(pointer)];
    if (!paths.has(jsonPointer(path))) throw new Error("Text edits require an explicitly declared field");
  }
  const texts: OrderedTextChange[] = [];
  for (const [pointer, path] of paths) {
    const text = await compileField(input, pointer, path);
    if (text) texts.push(text);
  }
  // A text update owns that exact leaf. Parent replacements still state their ordinary type change.
  return {
    texts,
    changes: changes.filter((change) => !texts.some((text) => jsonPointer(text.path) === jsonPointer(change.path))),
  };
};
