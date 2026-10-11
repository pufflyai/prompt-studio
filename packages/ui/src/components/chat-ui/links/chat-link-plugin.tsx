import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { TextNode } from "lexical";
import { useEffect } from "react";
import { MarkdownLinkNode } from "@/components/rich-text/shared/nodes/MarkdownLinkNode";
import { StreamingTextNode } from "@/components/rich-text/shared/nodes/streaming-text-node";
import { resolveChatCodeLink } from "./chat-code-link-transform";
import { type ChatLinkCandidate, type ChatLinkHandler, parseChatLink } from "./chat-link";
import { useChatLinkHandler } from "./chat-link-context";

const isModifiedClick = (event: MouseEvent | KeyboardEvent) =>
  event instanceof MouseEvent &&
  (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey);

const activateChatLink = (handler: ChatLinkHandler, event: MouseEvent | KeyboardEvent) => {
  if (event instanceof KeyboardEvent && event.key !== "Enter") return;
  const target = event.target;
  if (!(target instanceof Element)) return;
  const anchor = target.closest("a");
  if (!anchor) return;
  if (!anchor.dataset.chatSource) return;
  const candidate: ChatLinkCandidate = {
    source: anchor.dataset.chatSource,
    origin: anchor.dataset.chatOrigin === "markdown" ? "markdown" : "inline-code",
  };
  const parsed = parseChatLink(candidate, window.location.origin);
  if (!parsed) return;
  const href = handler.resolveHref(candidate);
  if (parsed.kind === "external" && !href) return;
  if (href && isModifiedClick(event)) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  void handler.open(candidate);
};

export const ChatLinkPlugin = () => {
  const [editor] = useLexicalComposerContext();
  const handler = useChatLinkHandler();
  useEffect(() => {
    if (!handler) return;
    const removeLink = editor.registerNodeTransform(MarkdownLinkNode, (node) => {
      const candidate: ChatLinkCandidate = { source: node.getSource(), origin: "markdown" };
      const parsed = parseChatLink(candidate, window.location.origin);
      if (parsed && (parsed.kind !== "external" || handler.resolveHref(candidate))) {
        node.setResolvedURL(handler.resolveHref(candidate) ?? "#");
      }
    });
    const removeLinkPresentation = editor.registerMutationListener(MarkdownLinkNode, (mutations) => {
      for (const [key, mutation] of mutations) {
        if (mutation === "destroyed") continue;
        const anchor = editor.getElementByKey(key);
        const source = anchor?.dataset.chatSource;
        if (!anchor || !source) continue;
        const candidate: ChatLinkCandidate = { source, origin: "markdown" };
        const parsed = parseChatLink(candidate, window.location.origin);
        if (parsed && (parsed.kind !== "external" || handler.resolveHref(candidate)))
          anchor.title = handler.describe?.(candidate) ?? `Open file or document: ${source}`;
      }
    });
    const transformCode = (node: TextNode) => resolveChatCodeLink(node, handler, window.location.origin);
    const removeCode = editor.registerNodeTransform(TextNode, transformCode);
    const removeStreamingCode = editor.registerNodeTransform(StreamingTextNode, transformCode);
    const activate = (event: MouseEvent | KeyboardEvent) => activateChatLink(handler, event);
    const removeRoot = editor.registerRootListener((root, previous) => {
      // Root listeners are replaced with the editor's root, including streamed content.
      previous?.removeEventListener("click", activate, true);
      previous?.removeEventListener("keydown", activate, true);
      root?.addEventListener("click", activate, true);
      root?.addEventListener("keydown", activate, true);
      if (root) root.dataset.chatLinks = "true";
    });
    return () => {
      removeLink();
      removeCode();
      removeStreamingCode();
      removeLinkPresentation();
      removeRoot();
    };
  }, [editor, handler]);
  return null;
};
