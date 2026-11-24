import { createHash } from "node:crypto";
import { encodeOrderedJson } from "./ordered-sql";

export type RetainedNamespace = "tombstones" | "authorship";
export interface RetainedEntry<T> {
  hash: string;
  content: { inline: { key: string; value: T } } | { external: true };
}
export type RetainedPage<T> =
  | { version: 1; type: "leaf"; entries: RetainedEntry<T>[] }
  | { version: 1; type: "branch"; children: string[] };

export const retainedHash = (key: string) => createHash("sha256").update(encodeOrderedJson(key)).digest("hex");
export const retainedPageKey = (namespace: RetainedNamespace, prefix: string) =>
  JSON.stringify(["ordered-retention", namespace, "page", prefix]);
export const retainedValueKey = (namespace: RetainedNamespace, hash: string) =>
  JSON.stringify(["ordered-retention", namespace, "value", hash]);
export const retainedInlineBytes = 8 * 1024;
export const retainedPageBytes = 64 * 1024;
export const retainedPageEntries = 128;
export const retainedLeaf = <T>(entries: RetainedEntry<T>[]): RetainedPage<T> => ({
  version: 1,
  type: "leaf",
  entries,
});
export const retainedPageFits = <T>(entries: RetainedEntry<T>[]) =>
  entries.length <= retainedPageEntries && encodeOrderedJson(retainedLeaf(entries)).byteLength <= retainedPageBytes;

const fields = (input: unknown, keys: string[]) => {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Invalid retained page object");
  const value = input as Record<string, unknown>;
  if (Object.keys(value).length !== keys.length || keys.some((key) => !Object.hasOwn(value, key)))
    throw new Error("Invalid retained page fields");
  return value;
};

const readEntry = (input: unknown, prefix: string) => {
  const entry = fields(input, ["hash", "content"]);
  if (typeof entry.hash !== "string" || !/^[a-f0-9]{64}$/.test(entry.hash) || !entry.hash.startsWith(prefix))
    throw new Error("Invalid retained page address");
  if (!entry.content || typeof entry.content !== "object") throw new Error("Invalid retained page content");
  const external = Object.hasOwn(entry.content, "external");
  const content = fields(entry.content, [external ? "external" : "inline"]);
  if (external) {
    if (content.external !== true) throw new Error("Invalid retained external value");
  } else {
    const inline = fields(content.inline, ["key", "value"]);
    if (typeof inline.key !== "string" || retainedHash(inline.key) !== entry.hash)
      throw new Error("Invalid retained value address");
    if (encodeOrderedJson(inline).byteLength > retainedInlineBytes) throw new Error("Invalid retained inline extent");
  }
  return entry.hash;
};
const readLeaf = (entries: unknown, prefix: string) => {
  if (!Array.isArray(entries) || !entries.length || !retainedPageFits(entries))
    throw new Error("Invalid retained page extent");
  let previous = "";
  for (const input of entries) {
    const hash = readEntry(input, prefix);
    if (hash <= previous) throw new Error("Invalid retained page ordering");
    previous = hash;
  }
};
const readBranch = (children: unknown, prefix: string) => {
  if (
    prefix.length === 64 ||
    !Array.isArray(children) ||
    !children.length ||
    children.length > 16 ||
    children.some((key) => typeof key !== "string" || !/^[a-f0-9]$/.test(key)) ||
    new Set(children).size !== children.length
  )
    throw new Error("Invalid retained page branch");
};
/** This is device-private authoritative storage, distinct from the encrypted relay receipt format. */
export const readRetainedPage = <T>(input: unknown, prefix: string) => {
  const page = fields(input, [
    "version",
    "type",
    (input as { type?: string })?.type === "leaf" ? "entries" : "children",
  ]);
  if (page.version !== 1 || !/^[a-f0-9]{0,64}$/.test(prefix)) throw new Error("Invalid retained page version or route");
  if (page.type === "branch") readBranch(page.children, prefix);
  else if (page.type === "leaf") readLeaf(page.entries, prefix);
  else throw new Error("Invalid retained page type");
  return input as RetainedPage<T>;
};
