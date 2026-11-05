import type { Root } from "mdast";
import { parseMarkdownSource } from "./markdown-ast";

/** One document retains its loaded spellings and only the latest changing source. */
export const createMarkdownSourceParser = (loaded: string[]) => {
  const retained = new Set(loaded);
  const trees = new Map<string, Root>();
  let latest: string | undefined;
  return (source: string) => {
    const cached = trees.get(source);
    if (cached) return cached;
    if (!retained.has(source)) {
      if (latest !== undefined) trees.delete(latest);
      latest = source;
    }
    const tree = parseMarkdownSource(source);
    trees.set(source, tree);
    return tree;
  };
};
