import { $isTextNode, DecoratorNode, type LexicalNode, type NodeKey, type SerializedLexicalNode } from "lexical";
import type { ReactElement } from "react";
import { resolveMarkdownUrl } from "@/components/rich-text/shared/markdown-url";
import { MarkdownLinkNode } from "@/components/rich-text/shared/nodes/MarkdownLinkNode";
import { CHAT_TEXT_FORMAT_TAGS, hasChatTextFormat } from "./chat-guess-text";
import type { ChatLinkCandidate } from "./chat-link";
import { ChatResourceLink } from "./chat-resource-link";

export interface SerializedChatResourceLink extends SerializedLexicalNode {
  candidate: ChatLinkCandidate;
  label: string;
  format?: number;
}

export class ChatResourceLinkNode extends DecoratorNode<ReactElement> {
  __candidate: ChatLinkCandidate;
  __label: string;
  // The replaced text's bold, italic and code formats, kept for text that stays unlinked.
  __format: number;
  static getType() {
    return "chat-resource-link";
  }
  static clone(node: ChatResourceLinkNode) {
    return new ChatResourceLinkNode(node.__candidate, node.__label, node.__format, node.__key);
  }
  constructor(candidate: ChatLinkCandidate, label: string, format = 0, key?: NodeKey) {
    super(key);
    this.__candidate = candidate;
    this.__label = label;
    this.__format = format;
  }
  static importJSON(value: SerializedChatResourceLink) {
    return new ChatResourceLinkNode(value.candidate, value.label, value.format);
  }
  exportJSON(): SerializedChatResourceLink {
    return {
      ...super.exportJSON(),
      type: this.getType(),
      version: 1,
      candidate: this.__candidate,
      label: this.__label,
      format: this.__format,
    };
  }
  createDOM() {
    return document.createElement("span");
  }
  // Pasted HTML stays links, code and text; it never recreates a bubble.
  static importDOM() {
    return null;
  }
  // Copy writes HTML from this export. Keep the text so a pasted message has no gaps.
  exportDOM() {
    let element: HTMLElement | Text = document.createTextNode(this.__label);
    for (const [type, tag] of CHAT_TEXT_FORMAT_TAGS.toReversed()) {
      if (!hasChatTextFormat(this.__format, type)) continue;
      const wrapper = document.createElement(tag);
      wrapper.append(element);
      element = wrapper;
    }
    const href = this.__candidate.origin === "markdown" && resolveMarkdownUrl(this.__candidate.source, "link");
    if (!href) return { element };
    const anchor = document.createElement("a");
    anchor.setAttribute("href", href);
    anchor.append(element);
    return { element: anchor };
  }
  updateDOM() {
    return false;
  }
  isInline() {
    return true;
  }
  getTextContent() {
    return this.__label;
  }
  matchesSource(node: LexicalNode) {
    if (this.__candidate.origin === "markdown")
      return (
        node instanceof MarkdownLinkNode &&
        node.getSource() === this.__candidate.source &&
        node.getTextContent() === this.__label
      );
    return $isTextNode(node) && node.getFormat() === this.__format && node.getTextContent() === this.__candidate.source;
  }
  decorate() {
    return <ChatResourceLink candidate={this.__candidate} label={this.__label} format={this.__format} />;
  }
}
