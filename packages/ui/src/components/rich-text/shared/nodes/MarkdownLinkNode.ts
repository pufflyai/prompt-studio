import { type LinkAttributes, LinkNode, type SerializedLinkNode } from "@lexical/link";
import {
  $applyNodeReplacement,
  type EditorConfig,
  type LexicalNode,
  type NodeKey,
  type SerializedLexicalNode,
  type Spread,
} from "lexical";
import { type MarkdownUrlResolver, resolveMarkdownUrl } from "../markdown-url";

export type SerializedMarkdownLinkNode = Spread<{ source: string }, Spread<SerializedLinkNode, SerializedLexicalNode>>;

const safeLinkUrl = (source: string, resolver?: MarkdownUrlResolver) =>
  resolveMarkdownUrl(source, "link", resolver) ?? "about:blank";

export class MarkdownLinkNode extends LinkNode {
  __source: string;

  static getType() {
    return "markdown-link";
  }

  static clone(node: MarkdownLinkNode) {
    return new MarkdownLinkNode(
      node.__source,
      node.__url,
      { rel: node.__rel, target: node.__target, title: node.__title },
      node.__key,
    );
  }

  constructor(source = "", resolvedUrl?: string | null, attributes?: LinkAttributes, key?: NodeKey) {
    super(resolvedUrl ?? safeLinkUrl(source), attributes, key);
    this.__source = source;
  }

  createDOM(config: EditorConfig) {
    const anchor = super.createDOM(config);
    anchor.dataset.chatSource = this.__source;
    anchor.dataset.chatOrigin = "markdown";
    return anchor;
  }

  updateDOM(previous: this, anchor: HTMLAnchorElement, config: EditorConfig) {
    const changed = super.updateDOM(previous, anchor, config);
    anchor.dataset.chatSource = this.__source;
    return changed;
  }

  getSource() {
    return this.__source;
  }

  setResolvedURL(url: string) {
    if (this.getURL() !== url) this.getWritable().__url = url;
    return this;
  }

  setURL(url: string) {
    const writable = this.getWritable();
    writable.__source = url;
    writable.__url = safeLinkUrl(url);
    return writable;
  }

  exportJSON(): SerializedMarkdownLinkNode {
    return {
      ...super.exportJSON(),
      source: this.__source,
      type: "markdown-link",
      version: 1,
    };
  }

  static importJSON(node: SerializedMarkdownLinkNode) {
    return $createMarkdownLinkNode(node.source, undefined, {
      rel: node.rel,
      target: node.target,
      title: node.title,
    });
  }
}

export const $createMarkdownLinkNode = (source: string, resolver?: MarkdownUrlResolver, attributes?: LinkAttributes) =>
  $applyNodeReplacement(new MarkdownLinkNode(source, safeLinkUrl(source, resolver), attributes));

export const $isMarkdownLinkNode = (node: LexicalNode | null | undefined): node is MarkdownLinkNode =>
  node instanceof MarkdownLinkNode;
