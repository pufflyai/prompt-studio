import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useEffect } from "react";
import { registerQuoteExitShortcut } from "./quote-exit-shortcut";

export function QuoteExitShortcutPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => registerQuoteExitShortcut(editor), [editor]);

  return null;
}
