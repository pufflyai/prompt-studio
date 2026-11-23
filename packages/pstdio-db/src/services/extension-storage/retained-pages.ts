import { and, eq } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import { documents } from "../../db/schemas/documents";
import { readFileDocumentHead } from "./document-file-persistence";
import { documentFilesFor, trackDocumentFiles } from "./document-files";
import { readOrderedMarker, saveOrderedMarker } from "./ordered-native-metadata";
import { encodeOrderedJson, type OrderedTransaction, orderedOwnerWhere } from "./ordered-sql";
import {
  type RetainedEntry,
  type RetainedNamespace,
  type RetainedPage,
  readRetainedPage,
  retainedHash,
  retainedInlineBytes,
  retainedLeaf,
  retainedPageFits,
  retainedPageKey,
  retainedValueKey,
} from "./retained-page-format";

/** Call inside the owner's SQL transaction. Page references, large values and deletions
 * commit together using the ordinary private document file publication/collection fence. */
export const createRetainedPages = <T>(tx: OrderedTransaction, owner: StorageOwner, namespace: RetainedNamespace) => {
  const remove = async (key: string) => {
    const rows = await tx
      .delete(documents)
      .where(and(orderedOwnerWhere(documents, owner), eq(documents.key, key)))
      .returning({ id: documents.id });
    for (const row of rows) trackDocumentFiles(tx, owner.workbenchId, row.id);
  };
  const read = async (prefix: string, required = false) => {
    const saved = await readOrderedMarker<unknown>(tx, owner, retainedPageKey(namespace, prefix));
    if (!saved) {
      if (required) throw new Error("The retained page is missing");
      return;
    }
    return readRetainedPage<T>(saved.value, prefix);
  };
  const save = (prefix: string, page: RetainedPage<T>) =>
    saveOrderedMarker(tx, owner, retainedPageKey(namespace, prefix), page);
  const load = async (entry: RetainedEntry<T>) => {
    if ("inline" in entry.content) return entry.content.inline;
    const saved = await readOrderedMarker<{ key: string; value: T }>(
      tx,
      owner,
      retainedValueKey(namespace, entry.hash),
    );
    if (
      !saved ||
      typeof saved.value?.key !== "string" ||
      retainedHash(saved.value.key) !== entry.hash ||
      !Object.hasOwn(saved.value, "value")
    )
      throw new Error("The retained value is missing or has a different identity");
    return saved.value;
  };
  type Write = (prefix: string, entries: RetainedEntry<T>[]) => Promise<void>;
  const write: Write = async (prefix, entries) => {
    if (retainedPageFits(entries)) return save(prefix, retainedLeaf(entries));
    if (prefix.length === 64) throw new Error("Retained page hash collision");
    const groups = new Map<string, RetainedEntry<T>[]>();
    for (const entry of entries) {
      const digit = entry.hash[prefix.length]!;
      const group = groups.get(digit) ?? [];
      group.push(entry);
      groups.set(digit, group);
    }
    for (const [digit, group] of groups) await write(prefix + digit, group);
    await save(prefix, { version: 1, type: "branch", children: [...groups.keys()].sort() });
  };
  type Edit = { key: string; hash: string; value: T | undefined };
  const editEntry = async (previous: RetainedEntry<T> | undefined, edit: Edit) => {
    if (previous && (await load(previous)).key !== edit.key) throw new Error("Retained page hash collision");
    const content = { key: edit.key, value: edit.value };
    const external = edit.value !== undefined && encodeOrderedJson(content).byteLength > retainedInlineBytes;
    if (previous && "external" in previous.content && !external) await remove(retainedValueKey(namespace, edit.hash));
    if (edit.value === undefined) return;
    if (external) await saveOrderedMarker(tx, owner, retainedValueKey(namespace, edit.hash), content);
    const entry: RetainedEntry<T> = {
      hash: edit.hash,
      content: external ? { external: true } : { inline: { key: edit.key, value: edit.value } },
    };
    return entry;
  };
  const editLeaf = async (before: RetainedEntry<T>[], edits: Edit[]) => {
    const entries = new Map(before.map((entry) => [entry.hash, entry]));
    for (const edit of edits) {
      const entry = await editEntry(entries.get(edit.hash), edit);
      if (entry) entries.set(edit.hash, entry);
      else entries.delete(edit.hash);
    }
    return [...entries.values()].sort((a, b) => (a.hash < b.hash ? -1 : 1));
  };
  type Update = (prefix: string, edits: Edit[], required?: boolean) => Promise<boolean>;
  const editBranch = async (prefix: string, before: string[], edits: Edit[]) => {
    const children = new Set(before);
    const groups = new Map<string, Edit[]>();
    for (const edit of edits) {
      const digit = edit.hash[prefix.length]!;
      const group = groups.get(digit) ?? [];
      group.push(edit);
      groups.set(digit, group);
    }
    for (const [digit, group] of groups) {
      if (await update(prefix + digit, group, children.has(digit))) children.add(digit);
      else children.delete(digit);
    }
    return [...children].sort();
  };
  const update: Update = async (prefix, edits, required = false) => {
    const page = await read(prefix, required);
    if (page?.type === "branch") {
      const children = await editBranch(prefix, page.children, edits);
      if (children.length) {
        await save(prefix, { version: 1, type: "branch", children });
        return true;
      }
      await remove(retainedPageKey(namespace, prefix));
      return false;
    }
    const entries = await editLeaf(page?.entries ?? [], edits);
    if (!entries.length) {
      if (page) await remove(retainedPageKey(namespace, prefix));
      return false;
    }
    await write(prefix, entries);
    return true;
  };
  const find = async (key: string) => {
    const hash = retainedHash(key);
    let prefix = "";
    let required = false;
    while (true) {
      const page = await read(prefix, required);
      if (!page) return;
      if (page.type === "leaf") return page.entries.find((entry) => entry.hash === hash);
      const digit = hash[prefix.length]!;
      if (!page.children.includes(digit)) return;
      prefix += digit;
      required = true;
    }
  };
  const entries = async function* (
    skip: ReadonlySet<string> = new Set(),
    prefix = "",
    required = false,
  ): AsyncGenerator<{ key: string; value: T }> {
    const page = await read(prefix, required);
    if (!page) return;
    if (page.type === "branch") {
      for (const digit of [...page.children].sort()) yield* entries(skip, prefix + digit, true);
    } else for (const entry of page.entries) if (!skip.has(entry.hash)) yield await load(entry);
  };
  return {
    entries,
    async has(key: string) {
      return !!(await find(key));
    },
    /** Snapshot extent comes from the authenticated file head, not its small SQL descriptor. */
    async bytes(key: string) {
      const entry = await find(key);
      if (!entry) return;
      if ("inline" in entry.content) return encodeOrderedJson(entry.content.inline).byteLength;
      const [row] = await tx
        .select()
        .from(documents)
        .where(and(orderedOwnerWhere(documents, owner), eq(documents.key, retainedValueKey(namespace, entry.hash))));
      if (!row) throw new Error("The retained value is missing");
      const head = await readFileDocumentHead(documentFilesFor(tx), owner.workbenchId, row);
      if (head.updates.length) throw new Error("A retained value cannot contain document updates");
      return head.snapshot.bytes;
    },
    async get(key: string) {
      const entry = await find(key);
      if (!entry) return;
      const saved = await load(entry);
      if (saved.key !== key) throw new Error("Retained page hash collision");
      return saved.value;
    },
    async set(edits: { key: string; value: T | undefined }[]) {
      if (edits.length > 100) throw new Error("Write at most 100 retained entries per batch");
      // Capture values before a file or SQL boundary, including nested callback transactions.
      const captured = structuredClone(edits).map((edit) => ({ ...edit, hash: retainedHash(edit.key) }));
      if (new Set(captured.map((edit) => edit.key)).size !== captured.length)
        throw new Error("Retained entries must have unique identities");
      if (captured.length) await update("", captured);
    },
  };
};
