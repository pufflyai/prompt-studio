import { CodeNode } from "@lexical/code";
import { $getSelection, $isRangeSelection, $nodesOfType } from "lexical";
import { MermaidNode } from "../MermaidPlugin/MermaidNode";
import { $createCodeBlockNode } from "./CodeNode";
import { queueCodeBlockFocus } from "./code-block-focus";

export function isMermaidLanguage(language: string) {
  return language.trim().toLowerCase() === "mermaid";
}

export function replaceImportedCodeBlocks() {
  const codeNodes = $nodesOfType(CodeNode);

  for (const node of codeNodes) {
    const language = node.getLanguage() ?? "plaintext";
    const code = node.getTextContent();
    node.replace(isMermaidLanguage(language) ? new MermaidNode(code) : $createCodeBlockNode(language, code));
  }
}

export function insertCodeBlockFromSelection(language = "plaintext") {
  const selection = $getSelection();

  if (!$isRangeSelection(selection)) {
    return false;
  }

  const codeBlockNode = $createCodeBlockNode(language, selection.getTextContent());
  queueCodeBlockFocus(codeBlockNode.getKey());
  selection.insertNodes([codeBlockNode]);
  return true;
}
