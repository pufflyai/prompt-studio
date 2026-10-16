import { $isTextNode, type LexicalNode } from "lexical";
import { parseChatLink } from "./chat-link";

export const findChatTextPaths = (text: string) => {
  const paths: { source: string; start: number; end: number }[] = [];
  for (const token of text.matchAll(/[^\s`"'<>()[\]{}]+/g)) {
    const source = token[0].replace(/[.,;:!?]+$/, "");
    const parsed = parseChatLink({ source, origin: "text" });
    if (parsed?.kind !== "file") continue;
    const explicit = /^(?:\.\.?[/\\]|\/|[a-z]:[/\\]|file:|\$PROJECT\/)/i.test(source);
    const fileName = /(?:^|[/\\])[^/\\]+\.[a-z][\w-]*$/i.test(parsed.path);
    if (!explicit && (!fileName || /^(?:@|v\d|e\.g$|i\.e$)/i.test(source))) continue;
    const start = token.index;
    paths.push({ source, start, end: start + source.length });
  }
  return paths;
};

// Split complete paths before streaming reconciliation, so a path assembled across
// arrival chunks can become one bubble and keep its identity on later updates.
export const splitChatTextPaths = (node: LexicalNode) => {
  if (!$isTextNode(node) || node.hasFormat("code")) return [node];
  const parent = node.getParent();
  if (!parent || parent.getType() === "code" || parent.getType().includes("link")) return [node];
  const length = node.getTextContentSize();
  const offsets = [...new Set(findChatTextPaths(node.getTextContent()).flatMap(({ start, end }) => [start, end]))]
    .filter((offset) => offset > 0 && offset < length)
    .sort((left, right) => left - right);
  return offsets.length ? node.splitText(...offsets) : [node];
};
