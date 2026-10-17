import { $getRoot, $isElementNode, $isTextNode, type ElementNode, type LexicalNode, type TextNode } from "lexical";
import { ChatCodeLinkNode } from "../../chat-ui/links/chat-code-link-node";
import { ChatResourceLinkNode } from "../../chat-ui/links/chat-resource-link-node";
import { splitChatTextPaths } from "../../chat-ui/links/chat-text-paths";
import { createMarkdownLexicalNodes } from "./markdown-import";
import type { MarkdownUrlResolver } from "./markdown-url";
import { $createStreamingTextNode } from "./nodes/streaming-text-node";

const sameAttributes = (left: LexicalNode, right: LexicalNode) => {
  const attributes = (node: LexicalNode) => {
    const { children: _children, ...rest } = node.exportJSON() as ReturnType<LexicalNode["exportJSON"]> & {
      children?: unknown;
    };
    if (node instanceof ChatCodeLinkNode) {
      return JSON.stringify({ ...rest, href: node.__href, description: node.__description });
    }
    return JSON.stringify(rest);
  };
  return attributes(left) === attributes(right);
};

const sameTextFormat = (left: TextNode, right: TextNode) =>
  left.getFormat() === right.getFormat() && left.getStyle() === right.getStyle();
const isChunkText = (node: LexicalNode | undefined): node is TextNode =>
  Boolean(node && $isTextNode(node) && ["text", "streaming-text"].includes(node.getType()));
const arrivingText = (next: TextNode, text: string) =>
  $createStreamingTextNode(text).setFormat(next.getFormat()).setStyle(next.getStyle());

const markNewText = (node: LexicalNode, animate: boolean) => {
  if (!animate) return node;
  if (isChunkText(node)) return arrivingText(node, node.getTextContent());
  const pending = [node];
  while (pending.length) {
    const current = pending.pop();
    if (!$isElementNode(current)) continue;
    for (const child of current.getChildren()) {
      if (isChunkText(child)) child.replace(arrivingText(child, child.getTextContent()));
      else pending.push(child);
    }
  }
  return node;
};

const reconcileText = (next: TextNode, previous: LexicalNode[], start: number, animate: boolean) => {
  const nodes: LexicalNode[] = [];
  let cursor = start;
  let old = previous[cursor];
  let remaining = next.getTextContent();
  while (
    $isTextNode(old) &&
    sameTextFormat(old, next) &&
    old.getTextContent().length > 0 &&
    remaining.startsWith(old.getTextContent()) &&
    (remaining.length === old.getTextContentSize() || isChunkText(old))
  ) {
    remaining = remaining.slice(old.getTextContentSize());
    nodes.push(old);
    old = previous[++cursor];
  }
  if (remaining && isChunkText(old)) {
    // Reinterpreted text is already visible; do not fade it a second time.
    old.setTextContent(remaining).setFormat(next.getFormat()).setStyle(next.getStyle());
    nodes.push(old);
    cursor += 1;
  } else if (remaining) {
    nodes.push(animate ? arrivingText(next, remaining) : next.setTextContent(remaining).toggleUnmergeable());
  }
  return { nodes, cursor };
};

// Markdown may reinterpret unfinished syntax. Reconcile that affected structure,
// while completed blocks and earlier chunks keep their keys and DOM.
const reconcileChildren = (parent: ElementNode, nextNodes: LexicalNode[], animate: boolean) => {
  const previous = parent.getChildren();
  const result: LexicalNode[] = [];
  let cursor = 0;
  for (const next of nextNodes.flatMap(splitChatTextPaths)) {
    const old = previous[cursor];
    if (old instanceof ChatResourceLinkNode && old.matchesSource(next)) {
      result.push(old);
      cursor += 1;
      continue;
    }
    if (isChunkText(next)) {
      const text = reconcileText(next, previous, cursor, animate);
      result.push(...text.nodes);
      cursor = text.cursor;
      continue;
    }
    if (old && sameAttributes(old, next)) {
      if ($isElementNode(old) && $isElementNode(next)) reconcileChildren(old, next.getChildren(), animate);
      result.push(old);
      cursor += 1;
    } else {
      result.push(markNewText(next, animate && !old));
      if (old) cursor += 1;
    }
  }
  if (result.length !== previous.length || result.some((node, index) => node.getKey() !== previous[index]?.getKey())) {
    parent.splice(0, parent.getChildrenSize(), result);
  }
};

export const importStreamingMarkdownToLexical = (markdown: string, resolver?: MarkdownUrlResolver, animate = true) => {
  reconcileChildren($getRoot(), createMarkdownLexicalNodes(markdown, resolver), animate);
};
