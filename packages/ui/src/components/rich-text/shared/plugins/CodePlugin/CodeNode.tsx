import { $applyNodeReplacement, DecoratorNode, type LexicalNode, type SerializedLexicalNode } from "lexical";
import type { ReactNode } from "react";
import { CodeBlockComponent } from "./CodeBlockComponent";

export interface SerializedCodeBlockNode extends SerializedLexicalNode {
  type: "codeblock";
  language: string;
  code: string;
  version: 1;
}

export class CodeBlockNode extends DecoratorNode<ReactNode> {
  __language: string;
  __code: string;

  static getType() {
    return "codeblock";
  }

  static clone(node: CodeBlockNode) {
    return new CodeBlockNode(node.__language, node.__code, node.__key);
  }

  constructor(language: string, code: string, key?: string) {
    super(key);
    this.__language = language;
    this.__code = code;
  }

  createDOM() {
    return document.createElement("div");
  }

  updateDOM() {
    return false;
  }

  static importJSON(serializedNode: SerializedCodeBlockNode): CodeBlockNode {
    const { language, code } = serializedNode;
    return new CodeBlockNode(language, code);
  }

  exportJSON(): SerializedCodeBlockNode {
    return {
      type: "codeblock",
      language: this.__language,
      code: this.__code,
      version: 1,
    };
  }

  // Used by Lexical's markdown export as fallback for DecoratorNodes
  getTextContent() {
    return `\`\`\`${this.__language}\n${this.__code}\n\`\`\``;
  }

  getCode() {
    return this.__code;
  }

  setCode(code: string) {
    const writable = this.getWritable();
    writable.__code = code;
  }

  getLanguage() {
    return this.__language;
  }

  decorate() {
    return <CodeBlockComponent language={this.__language || "plaintext"} code={this.__code} nodeKey={this.__key} />;
  }
}

export function $createCodeBlockNode(language = "plaintext", code = "") {
  const codeBlockNode = new CodeBlockNode(language, code);
  return $applyNodeReplacement(codeBlockNode);
}

export function $isCodeBlockNode(node: LexicalNode | null | undefined): node is CodeBlockNode {
  return node instanceof CodeBlockNode;
}
