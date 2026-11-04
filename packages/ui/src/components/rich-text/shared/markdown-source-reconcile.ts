import { diffArrays } from "diff";
import { $getRoot, $isElementNode, type LexicalNode } from "lexical";
import { exportLexicalBlockToMarkdown } from "./markdown-export";
import { createMarkdownLexicalNodes } from "./markdown-import";
import { type MarkdownTableProjection, markdownTableNodes } from "./markdown-source-tables";
import type { MarkdownUrlResolver } from "./markdown-url";

const blockIdentity = (node: LexicalNode) =>
  JSON.stringify([exportLexicalBlockToMarkdown(node), markdownTableNodes([node]).map((table) => table.getKey())]);

/** Keep unchanged Lexical blocks, including their node keys and selection points. */
export const reconcileMarkdownSource = (
  source: string,
  resolver?: MarkdownUrlResolver,
  projection?: MarkdownTableProjection,
) => {
  const root = $getRoot();
  const next = createMarkdownLexicalNodes(source, resolver);
  const tables = projection?.restore(next, source);
  const stack = [...next];
  while (stack.length) {
    const node = stack.pop()!;
    if (!$isElementNode(node)) continue;
    for (const child of node.getChildren()) {
      const preserved = tables?.get(child.getKey());
      if (preserved) child.replace(preserved);
      else stack.push(child);
    }
  }
  const desired = next.map((node) => tables?.get(node.getKey()) ?? node);
  const current = root.getChildren();
  const changes = diffArrays(current.map(blockIdentity), desired.map(blockIdentity));
  let cursor = 0;
  let nextIndex = 0;
  for (const change of changes) {
    if (change.removed) {
      root.splice(cursor, change.count, []);
      continue;
    }
    if (change.added) root.splice(cursor, 0, desired.slice(nextIndex, nextIndex + change.count));
    cursor += change.count;
    nextIndex += change.count;
  }
};
