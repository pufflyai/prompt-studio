import {
  DecoratorNode,
  type EditorConfig,
  type LexicalEditor,
  type LexicalNode,
  type NodeKey,
  type SerializedLexicalNode,
  type Spread,
} from "lexical";
import type { ReactElement } from "react";
import { ReferenceLinkBadge } from "@/components/rich-text/shared/components/reference-link-badge";

export type SerializedReferenceLinkNode = Spread<
  {
    href: string;
    label?: string;
  },
  SerializedLexicalNode
>;

export class ReferenceLinkNode extends DecoratorNode<ReactElement> {
  __href: string;
  __label?: string;

  static getType(): string {
    return "reference-link";
  }

  static clone(node: ReferenceLinkNode): ReferenceLinkNode {
    return new ReferenceLinkNode(node.__href, node.__label, node.__key);
  }

  constructor(href: string, label?: string, key?: NodeKey) {
    super(key);
    this.__href = href;
    this.__label = label;
  }

  createDOM(_config: EditorConfig, _editor: LexicalEditor): HTMLElement {
    return document.createElement("span");
  }

  updateDOM(_prevNode: ReferenceLinkNode, _dom: HTMLElement, _config: EditorConfig): boolean {
    return false;
  }

  getTextContent(): string {
    const label = this.__label ?? this.__href;
    return `{{link('${label}')}}`;
  }

  exportJSON(): SerializedReferenceLinkNode {
    return {
      type: ReferenceLinkNode.getType(),
      version: 1,
      href: this.__href,
      label: this.__label,
    };
  }

  static importJSON(serializedNode: SerializedReferenceLinkNode): ReferenceLinkNode {
    return $createReferenceLinkNode(serializedNode.href, serializedNode.label);
  }

  decorate(_editor: LexicalEditor, _config: EditorConfig): ReactElement {
    return <ReferenceLinkBadge href={this.__href} />;
  }
}

export function $createReferenceLinkNode(href: string, label?: string): ReferenceLinkNode {
  return new ReferenceLinkNode(href, label);
}

export function $isReferenceLinkNode(node: LexicalNode | null | undefined): node is ReferenceLinkNode {
  return node instanceof ReferenceLinkNode;
}
