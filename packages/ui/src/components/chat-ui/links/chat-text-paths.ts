import { $isTextNode, type LexicalNode } from "lexical";
import { parseChatLink } from "./chat-link";

const delimiters: Record<string, string> = { "(": ")", "[": "]", "{": "}" };

const pathToken = (value: string) => {
  let start = 0;
  let end = value.replace(/[.,;:!?]+$/, "").length;
  const pending: { close: string; index: number }[] = [];
  const pairs = new Map<number, number>();
  for (let index = 0; index < end; index++) {
    const character = value[index]!;
    const close = delimiters[character];
    if (close) pending.push({ close, index });
    else if (")]}".includes(character)) {
      const opening = pending.pop();
      if (opening?.close === character) pairs.set(opening.index, index);
      else if (!opening && /^[)\]}]+$/.test(value.slice(index, end))) {
        end = index;
        break;
      } else return undefined;
    }
  }
  if (pending.length) return undefined;
  // Prose may wrap a path in brackets; route groups and dynamic segments belong
  // to the path. Only unwrap a pair when it encloses the complete token.
  while (start < end && pairs.get(start) === end - 1) {
    start += 1;
    end -= 1;
  }
  return { source: value.slice(start, end), offset: start };
};

export const findChatTextPaths = (text: string) => {
  const paths: { source: string; start: number; end: number }[] = [];
  for (const token of text.matchAll(/[^\s`"'<>]+/g)) {
    const path = pathToken(token[0]);
    if (!path) continue;
    const { source, offset } = path;
    const parsed = parseChatLink({ source, origin: "text" });
    if (parsed?.kind !== "file") continue;
    const explicit = /^(?:\.\.?[/\\]|\/|[a-z]:[/\\]|file:|\$PROJECT\/)/i.test(source);
    const fileName = /(?:^|[/\\])[^/\\]+\.[a-z][\w-]*$/i.test(parsed.path);
    if (!explicit && (!fileName || /^(?:@|v\d|e\.g$|i\.e$)/i.test(source))) continue;
    const start = token.index + offset;
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
