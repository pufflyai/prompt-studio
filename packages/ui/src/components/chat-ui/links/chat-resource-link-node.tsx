import { $isTextNode, DecoratorNode, type LexicalNode, type NodeKey, type SerializedLexicalNode } from "lexical";
import type { ReactElement } from "react";
import { MarkdownLinkNode } from "@/components/rich-text/shared/nodes/MarkdownLinkNode";
import type { ChatLinkCandidate } from "./chat-link";
import { ChatResourceLink } from "./chat-resource-link";

interface SerializedChatResourceLink extends SerializedLexicalNode {
  candidate: ChatLinkCandidate;
  label: string;
}

export class ChatResourceLinkNode extends DecoratorNode<ReactElement> {
  __candidate: ChatLinkCandidate;
  __label: string;
  static getType() {
    return "chat-resource-link";
  }
  static clone(node: ChatResourceLinkNode) {
    return new ChatResourceLinkNode(node.__candidate, node.__label, node.__key);
  }
  constructor(candidate: ChatLinkCandidate, label: string, key?: NodeKey) {
    super(key);
    this.__candidate = candidate;
    this.__label = label;
  }
  static importJSON(value: SerializedChatResourceLink) {
    return new ChatResourceLinkNode(value.candidate, value.label);
  }
  exportJSON(): SerializedChatResourceLink {
    return {
      ...super.exportJSON(),
      type: ChatResourceLinkNode.getType(),
      version: 1,
      candidate: this.__candidate,
      label: this.__label,
    };
  }
  createDOM() {
    return document.createElement("span");
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
    return $isTextNode(node) && node.hasFormat("code") && node.getTextContent() === this.__candidate.source;
  }
  decorate() {
    return <ChatResourceLink candidate={this.__candidate} label={this.__label} />;
  }
}
