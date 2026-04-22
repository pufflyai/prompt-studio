import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useEffect } from "react";
import { replaceImportedCodeBlocks } from "./code-block-utils";

export function ImportCodeBlocksPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    editor.update(() => {
      replaceImportedCodeBlocks();
    });
  }, [editor]);

  return null;
}
