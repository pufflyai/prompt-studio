import { CodeNode } from "@lexical/code";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $nodesOfType } from "lexical";
import { useEffect } from "react";
import { MermaidNode } from "../MermaidPlugin/MermaidNode";
import { CodeBlockNode } from "./CodeNode";

function isMermaidLanguage(language: string) {
  return language.trim().toLowerCase() === "mermaid";
}

export function ImportCodeBlocksPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    editor.update(() => {
      const codeNodes = $nodesOfType(CodeNode);
      for (const n of codeNodes) {
        const lang = n.getLanguage() ?? "plaintext";
        const code = n.getTextContent();
        n.replace(isMermaidLanguage(lang) ? new MermaidNode(code) : new CodeBlockNode(lang, code));
      }
    });
  }, [editor]);

  return null;
}
