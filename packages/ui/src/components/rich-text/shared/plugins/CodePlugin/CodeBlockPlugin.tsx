import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $nodesOfType } from "lexical";
import { useEffect } from "react";
import { CodeNode } from "../../lexical-code";
import { MermaidNode } from "../MermaidPlugin/MermaidNode";

function isMermaidLanguage(language: string) {
  return language.trim().toLowerCase() === "mermaid";
}

export function replaceCodeNodeWithMermaidNode(node: CodeNode) {
  const language = node.getLanguage() ?? "plaintext";
  if (!isMermaidLanguage(language)) {
    return false;
  }

  node.replace(new MermaidNode(node.getTextContent()));
  return true;
}

export function ImportCodeBlocksPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    editor.update(() => {
      const codeNodes = $nodesOfType(CodeNode);
      for (const n of codeNodes) {
        replaceCodeNodeWithMermaidNode(n);
      }
    });
  }, [editor]);

  return null;
}
