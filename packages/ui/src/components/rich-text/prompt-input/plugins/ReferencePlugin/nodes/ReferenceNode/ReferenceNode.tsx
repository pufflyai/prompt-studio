import { addClassNamesToElement } from "@lexical/utils";
import {
  type DOMConversionMap,
  type DOMConversionOutput,
  type DOMExportOutput,
  type EditorConfig,
  type LexicalEditor,
  type LexicalNode,
  type NodeKey,
  type SerializedTextNode,
  type Spread,
  TextNode,
} from "lexical";

type SerializedReferenceNode = Spread<
  {
    referenceId: string;
    name: string;
  },
  SerializedTextNode
>;

export class ReferenceNode extends TextNode {
  __referenceId: string;
  __name: string;

  static getType(): string {
    return "reference";
  }

  static clone(node: ReferenceNode): ReferenceNode {
    return new ReferenceNode(node.__referenceId, node.__name, node.__key);
  }

  constructor(referenceId: string, name: string, key?: NodeKey) {
    super(name, key);
    this.__referenceId = referenceId;
    this.__name = name;
  }

  isKeyboardSelectable(): boolean {
    return false;
  }

  canBeEmpty(): boolean {
    return false;
  }

  canInsertTextAfter(): boolean {
    return false;
  }

  canInsertTextBefore(): boolean {
    return false;
  }

  createDOM(config: EditorConfig): HTMLElement {
    const span = document.createElement("span");
    addClassNamesToElement(span, config.theme.reference);
    span.setAttribute("data-reference-id", this.__referenceId);
    span.setAttribute("data-name", this.__name);
    span.textContent = `#${this.__name}`;
    return span;
  }

  updateDOM(prevNode: ReferenceNode, dom: HTMLElement): boolean {
    if (prevNode.__name !== this.__name || prevNode.__referenceId !== this.__referenceId) {
      dom.setAttribute("data-reference-id", this.__referenceId);
      dom.setAttribute("data-name", this.__name);
      dom.textContent = `#${this.__name}`;
    }

    return false;
  }

  exportDOM(_editor: LexicalEditor): DOMExportOutput {
    const el = document.createElement("span");
    el.setAttribute("data-reference-id", this.__referenceId);
    el.setAttribute("data-name", this.__name);
    el.textContent = `#${this.__name}`;
    return { element: el };
  }

  static importDOM(): DOMConversionMap | null {
    return {
      span: (domNode: HTMLElement) => {
        if (!domNode.hasAttribute("data-reference-id") || !domNode.hasAttribute("data-name")) {
          return null;
        }
        return {
          conversion: $convertReferenceElement,
          priority: 1,
        };
      },
    };
  }

  static importJSON(serializedNode: SerializedReferenceNode): ReferenceNode {
    const node = new ReferenceNode(serializedNode.referenceId, serializedNode.name);
    return node;
  }

  exportJSON(): SerializedReferenceNode {
    return {
      ...super.exportJSON(),
      type: "reference",
      referenceId: this.__referenceId,
      name: this.__name,
    };
  }

  getTextContent(): string {
    return `#${this.__name}`;
  }
}

function $convertReferenceElement(domNode: HTMLElement): DOMConversionOutput | null {
  const referenceId = domNode.getAttribute("data-reference-id");
  const name = domNode.getAttribute("data-name");
  if (!referenceId || !name) return null;
  return { node: $createReferenceNode(referenceId, name) };
}

export function $createReferenceNode(referenceId: string, name: string): ReferenceNode {
  return new ReferenceNode(referenceId, name);
}

export function $isReferenceNode(node: LexicalNode | null | undefined): node is ReferenceNode {
  return node instanceof ReferenceNode;
}
