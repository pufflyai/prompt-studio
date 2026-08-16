import { Box, Image, Text } from "@chakra-ui/react";
import {
  $applyNodeReplacement,
  DecoratorNode,
  type LexicalEditor,
  type LexicalNode,
  type NodeKey,
  type SerializedLexicalNode,
  type Spread,
} from "lexical";
import type { ReactNode } from "react";
import { resolveMarkdownUrl } from "../markdown-url";
import { useMarkdownUrlResolver } from "../markdown-url-context";

export type SerializedMarkdownImageNode = Spread<
  { source: string; alt: string; title: string | null },
  SerializedLexicalNode
>;

interface MarkdownImageProps {
  source: string;
  alt: string;
  title: string | null;
}

export const MarkdownImage = (props: MarkdownImageProps) => {
  const { source, alt, title } = props;
  const resolver = useMarkdownUrlResolver();
  const resolved = resolveMarkdownUrl(source, "image", resolver);

  if (!resolved) {
    return (
      <Box as="span" display="inline-block" paddingX="xs" paddingY="2xs" background="bg.muted" borderRadius="sm">
        <Text as="span" textStyle="label/S/regular" color="fg.muted">
          {alt || "Image"}
        </Text>
      </Box>
    );
  }

  return <Image src={resolved} alt={alt} title={title ?? undefined} loading="lazy" referrerPolicy="no-referrer" />;
};

export class MarkdownImageNode extends DecoratorNode<ReactNode> {
  __source: string;
  __alt: string;
  __title: string | null;

  static getType() {
    return "markdown-image";
  }

  static clone(node: MarkdownImageNode) {
    return new MarkdownImageNode(node.__source, node.__alt, node.__title, node.__key);
  }

  constructor(source: string, alt: string, title: string | null = null, key?: NodeKey) {
    super(key);
    this.__source = source;
    this.__alt = alt;
    this.__title = title;
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

  getSource() {
    return this.__source;
  }

  getAlt() {
    return this.__alt;
  }

  getTitle() {
    return this.__title;
  }

  getTextContent() {
    return this.__alt;
  }

  exportJSON(): SerializedMarkdownImageNode {
    return {
      type: "markdown-image",
      version: 1,
      source: this.__source,
      alt: this.__alt,
      title: this.__title,
    };
  }

  static importJSON(node: SerializedMarkdownImageNode) {
    return $createMarkdownImageNode(node.source, node.alt, node.title);
  }

  decorate(_editor: LexicalEditor) {
    return <MarkdownImage source={this.__source} alt={this.__alt} title={this.__title} />;
  }
}

export const $createMarkdownImageNode = (source: string, alt: string, title: string | null = null) =>
  $applyNodeReplacement(new MarkdownImageNode(source, alt, title));

export const $isMarkdownImageNode = (node: LexicalNode | null | undefined): node is MarkdownImageNode =>
  node instanceof MarkdownImageNode;
