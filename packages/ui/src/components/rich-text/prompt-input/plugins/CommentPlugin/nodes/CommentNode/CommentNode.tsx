import { addClassNamesToElement } from "@lexical/utils";
import {
  $createParagraphNode,
  type DOMConversionMap,
  type DOMConversionOutput,
  type DOMExportOutput,
  type EditorConfig,
  type ElementFormatType,
  ElementNode,
  isHTMLElement,
  type LexicalEditor,
  type ParagraphNode,
  type RangeSelection,
  type SerializedElementNode,
} from "lexical";

export type SerializedCommentNode = SerializedElementNode;

function convertCommentElement(element: HTMLElement): DOMConversionOutput {
  const node = $createCommentNode();
  if (element.style !== null) {
    node.setFormat(element.style.textAlign as ElementFormatType);
  }
  return { node };
}

export class CommentNode extends ElementNode {
  static getType(): string {
    return "comment";
  }

  static clone(node: CommentNode): CommentNode {
    return new CommentNode(node.__key);
  }

  createDOM(config: EditorConfig): HTMLElement {
    const element = document.createElement("blockquote");
    addClassNamesToElement(element, config.theme.comment);
    return element;
  }

  updateDOM(): boolean {
    return false;
  }

  static importDOM(): DOMConversionMap | null {
    return {
      blockquote: () => ({
        conversion: convertCommentElement,
        priority: 0,
      }),
    };
  }

  exportDOM(editor: LexicalEditor): DOMExportOutput {
    const { element } = super.exportDOM(editor);

    if (element && isHTMLElement(element)) {
      if (this.isEmpty()) {
        element.append(document.createElement("br"));
      }

      const formatType = this.getFormatType();
      element.style.textAlign = formatType;

      const direction = this.getDirection();
      if (direction) {
        element.dir = direction;
      }
    }

    return {
      element,
    };
  }

  static importJSON(serializedNode: SerializedCommentNode): CommentNode {
    const node = $createCommentNode();
    node.setFormat(serializedNode.format);
    node.setIndent(serializedNode.indent);
    node.setDirection(serializedNode.direction);
    return node;
  }

  exportJSON(): SerializedElementNode {
    return {
      ...super.exportJSON(),
      type: "comment",
    };
  }

  getTextContent(): string {
    const originalText = super.getTextContent();
    // escape { and } symbols
    const withEscapedReferences = originalText.replace(/([{}])/g, "\\$1");
    return `{{! ${withEscapedReferences} }}`;
  }

  // mutation

  insertNewAfter(_: RangeSelection, restoreSelection?: boolean): ParagraphNode {
    const newBlock = $createParagraphNode();
    const direction = this.getDirection();
    newBlock.setDirection(direction);
    this.insertAfter(newBlock, restoreSelection);
    return newBlock;
  }

  collapseAtStart(): true {
    const paragraph = $createParagraphNode();
    const children = this.getChildren();
    children.forEach((child) => {
      paragraph.append(child);
    });
    this.replace(paragraph);
    return true;
  }
}

export function $createCommentNode(): CommentNode {
  return new CommentNode();
}
