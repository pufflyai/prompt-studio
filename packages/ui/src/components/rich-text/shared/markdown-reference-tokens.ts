import type { PhrasingContent } from "mdast";

export const REFERENCE_TOKEN = /\{\{\s*link\((['"])([^'"\s]+)\1\)\s*\}\}/g;
const REFERENCE_PREFIX = /\{\{\s*link\((['"])[^'"\s]*$/;
const REFERENCE_AT_START = new RegExp(`^${REFERENCE_TOKEN.source}`);

const literalLinkText = (node: PhrasingContent) => {
  if (node.type !== "link" || !node.children.every((child) => child.type === "text")) return undefined;
  const text = node.children.map((child) => (child.type === "text" ? child.value : "")).join("");
  const start = node.position?.start.offset;
  const end = node.position?.end.offset;
  return start !== undefined && end !== undefined && end - start === text.length && node.url === text
    ? text
    : undefined;
};

// GFM can split a URL out of a reference token before the reference importer sees it.
// Rejoin only literal text and bare autolinks; formatted Markdown keeps its structure.
export const readReferenceText = (children: PhrasingContent[], start: number) => {
  const first = children[start];
  if (first?.type !== "text") return undefined;
  const prefix = first.value.match(REFERENCE_PREFIX);
  if (!prefix || prefix.index === undefined) return undefined;
  let value = first.value;
  for (let end = start + 1; end < children.length; end++) {
    const child = children[end]!;
    const text = child.type === "text" ? child.value : literalLinkText(child);
    if (text === undefined) return undefined;
    value += text;
    if (REFERENCE_AT_START.test(value.slice(prefix.index))) return { value, end };
  }
  return undefined;
};
