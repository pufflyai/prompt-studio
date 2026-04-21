import type { LexicalNode, NodeKey, SerializedLexicalNode } from "lexical";
import { $applyNodeReplacement, DecoratorNode } from "lexical";
import type { ReactNode } from "react";
import { lazy, Suspense } from "react";

const MermaidComponent = lazy(() => import("./MermaidComponent"));

export interface SerializedMermaidNode extends SerializedLexicalNode {
  type: "mermaid";
  code: string;
  version: 1;
}

export class MermaidNode extends DecoratorNode<ReactNode> {
  __code: string;

  static getType() {
    return "mermaid";
  }

  static clone(node: MermaidNode) {
    return new MermaidNode(node.__code, node.__key);
  }

  constructor(code: string, key?: NodeKey) {
    super(key);
    this.__code = code;
  }

  createDOM() {
    return document.createElement("div");
  }

  updateDOM() {
    return false;
  }

  static importJSON(serializedNode: SerializedMermaidNode): MermaidNode {
    return new MermaidNode(serializedNode.code);
  }

  exportJSON(): SerializedMermaidNode {
    return {
      type: "mermaid",
      code: this.__code,
      version: 1,
    };
  }

  getTextContent() {
    return `\`\`\`mermaid\n${this.__code}\n\`\`\``;
  }

  getCode() {
    return this.__code;
  }

  setCode(code: string) {
    const writable = this.getWritable();
    writable.__code = code;
  }

  decorate() {
    return (
      <Suspense fallback={null}>
        <MermaidComponent code={this.__code} nodeKey={this.__key} />
      </Suspense>
    );
  }
}

export function $createMermaidNode(code = "") {
  const mermaidNode = new MermaidNode(code);
  return $applyNodeReplacement(mermaidNode);
}

export function $isMermaidNode(node: LexicalNode | null | undefined): node is MermaidNode {
  return node instanceof MermaidNode;
}
