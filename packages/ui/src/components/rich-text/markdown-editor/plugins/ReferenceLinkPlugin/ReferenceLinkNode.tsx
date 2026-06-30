import { Box } from "@chakra-ui/react";
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
import { ResourceBadge } from "@/components/primitives/resource-badge";

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
    const href = this.__href;
    const fileName = href.split("/").pop();
    const label = fileName || "unknown";
    const isExternal = /^https?:\/\//i.test(href);
    const isProjectFile = /^#?\$PROJECT\//i.test(href);

    return (
      <Box width="fit-content" display="inline-block">
        <ResourceBadge
          fileName={label}
          onSelect={() => {
            if (isExternal) {
              window.open(href, "_blank", "noopener,noreferrer");
            } else if (isProjectFile) {
              const projectPath = href.replace(/^#?\$PROJECT\//i, "");
              const event = new CustomEvent("ui:open-project-file", { detail: projectPath });
              window.dispatchEvent(event);
            } else {
              window.location.assign(href);
            }
          }}
        />
      </Box>
    );
  }
}

export function $createReferenceLinkNode(href: string, label?: string): ReferenceLinkNode {
  return new ReferenceLinkNode(href, label);
}

export function $isReferenceLinkNode(node: LexicalNode | null | undefined): node is ReferenceLinkNode {
  return node instanceof ReferenceLinkNode;
}
