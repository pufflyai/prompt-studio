import { $isTextNode, type TextNode } from "lexical";
import { ChatResourceLinkNode } from "./chat-resource-link-node";
import { findChatTextPaths, splitChatTextPaths } from "./chat-text-paths";

export const resolveChatTextLinks = (node: TextNode) => {
  if (node.hasFormat("code")) return;
  const parent = node.getParent();
  if (!parent || parent.getType() === "code" || parent.getType().includes("link")) return;
  for (const part of splitChatTextPaths(node)) {
    const source = part.getTextContent();
    const path = findChatTextPaths(source)[0];
    if ($isTextNode(part) && path?.start === 0 && path.end === source.length) {
      part.replace(new ChatResourceLinkNode({ source, origin: "text" }, source, part.getFormat()));
    }
  }
};
