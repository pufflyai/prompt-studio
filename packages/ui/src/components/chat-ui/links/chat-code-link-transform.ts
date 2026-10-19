import type { TextNode } from "lexical";
import { StreamingTextNode } from "../../rich-text/shared/nodes/streaming-text-node";
import { ChatCodeLinkNode } from "./chat-code-link-node";
import { type ChatLinkCandidate, type ChatLinkHandler, parseChatLink } from "./chat-link";
import { ChatResourceLinkNode } from "./chat-resource-link-node";

export const resolveChatCodeLink = (node: TextNode, handler: ChatLinkHandler, origin: string, bubble = false) => {
  if (node instanceof ChatCodeLinkNode || !node.hasFormat("code")) return;
  const parent = node.getParent();
  if (!parent || parent.getType() === "code" || parent.getType().includes("link")) return;
  const candidate: ChatLinkCandidate = { source: node.getTextContent(), origin: "inline-code" };
  const parsed = parseChatLink(candidate, origin);
  if (!parsed || parsed.kind === "external") return;
  if (bubble) {
    node.replace(new ChatResourceLinkNode(candidate, candidate.source, node.getFormat()));
    return;
  }
  const replacement = new ChatCodeLinkNode(
    candidate.source,
    handler.resolveHref(candidate),
    handler.describe?.(candidate),
    undefined,
    node instanceof StreamingTextNode,
  );
  replacement.setFormat(node.getFormat());
  node.replace(replacement);
};
