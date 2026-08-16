import DOMPurify from "dompurify";
import {
  $applyNodeReplacement,
  DecoratorNode,
  type LexicalNode,
  type NodeKey,
  type SerializedLexicalNode,
  type Spread,
} from "lexical";
import { type ReactNode, useEffect, useRef } from "react";
import { resolveMarkdownUrl } from "../markdown-url";
import { useMarkdownUrlResolver } from "../markdown-url-context";

export type RawHtmlDisplay = "inline" | "block";

export type SerializedRawHtmlNode = Spread<{ source: string; display: RawHtmlDisplay }, SerializedLexicalNode>;

const isHtmlComment = (source: string) => /^<!--[\s\S]*-->$/.test(source.trim());

const sanitizeMarkdownHtml = (source: string, resolver: ReturnType<typeof useMarkdownUrlResolver>) => {
  if (typeof document === "undefined") return null;

  const clean = DOMPurify.sanitize(source, {
    FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form", "input", "button", "textarea", "select"],
  });
  const template = document.createElement("template");
  template.innerHTML = clean;

  for (const element of template.content.querySelectorAll<HTMLElement>("[href], [src]")) {
    const attribute = element.hasAttribute("href") ? "href" : "src";
    const kind = attribute === "href" ? "link" : "image";
    const sourceUrl = element.getAttribute(attribute) ?? "";
    const resolved = resolveMarkdownUrl(sourceUrl, kind, resolver);

    if (resolved) element.setAttribute(attribute, resolved);
    else element.removeAttribute(attribute);
  }

  return template.content;
};

interface RawHtmlProps {
  source: string;
  display: RawHtmlDisplay;
}

export const RawHtml = (props: RawHtmlProps) => {
  const { source, display } = props;
  const resolver = useMarkdownUrlResolver();
  const elementRef = useRef<HTMLElement | null>(null);
  const attachElement = (element: HTMLElement | null) => {
    elementRef.current = element;
  };

  useEffect(() => {
    const fragment = sanitizeMarkdownHtml(source, resolver);
    const element = elementRef.current;
    if (!element) return;

    element.replaceChildren(fragment ? fragment.cloneNode(true) : document.createTextNode(""));
  }, [resolver, source]);

  if (isHtmlComment(source)) return null;
  if (display === "inline") return <span ref={attachElement} />;
  return <div ref={attachElement} />;
};

export class RawHtmlNode extends DecoratorNode<ReactNode> {
  __source: string;
  __display: RawHtmlDisplay;

  static getType() {
    return "raw-html";
  }

  static clone(node: RawHtmlNode) {
    return new RawHtmlNode(node.__source, node.__display, node.__key);
  }

  constructor(source: string, display: RawHtmlDisplay, key?: NodeKey) {
    super(key);
    this.__source = source;
    this.__display = display;
  }

  createDOM() {
    return document.createElement(this.__display === "inline" ? "span" : "div");
  }

  updateDOM(previous: RawHtmlNode) {
    return previous.__display !== this.__display;
  }

  isInline() {
    return this.__display === "inline";
  }

  getSource() {
    return this.__source;
  }

  getDisplay() {
    return this.__display;
  }

  getTextContent() {
    return isHtmlComment(this.__source) ? "" : this.__source;
  }

  exportJSON(): SerializedRawHtmlNode {
    return {
      type: "raw-html",
      version: 1,
      source: this.__source,
      display: this.__display,
    };
  }

  static importJSON(node: SerializedRawHtmlNode) {
    return $createRawHtmlNode(node.source, node.display);
  }

  decorate() {
    return <RawHtml source={this.__source} display={this.__display} />;
  }
}

export const $createRawHtmlNode = (source: string, display: RawHtmlDisplay) =>
  $applyNodeReplacement(new RawHtmlNode(source, display));

export const $isRawHtmlNode = (node: LexicalNode | null | undefined): node is RawHtmlNode =>
  node instanceof RawHtmlNode;
