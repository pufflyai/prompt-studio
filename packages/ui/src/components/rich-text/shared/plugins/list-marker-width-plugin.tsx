import { ListNode } from "@lexical/list";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useEffect } from "react";

// List numbers sit in the indent before each item. Each numbered list records the
// digit count of its widest number so the theme can make the indent wide enough.
export function ListMarkerWidthPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(
    () =>
      editor.registerMutationListener(ListNode, (mutations) => {
        for (const [key, mutation] of mutations) {
          if (mutation === "destroyed") continue;
          const list = editor.getElementByKey(key);
          if (!(list instanceof HTMLOListElement)) continue;
          const values = [...list.children].flatMap((item) => (item instanceof HTMLLIElement ? [item.value] : []));
          list.style.setProperty("--rich-text-list-digits", String(Math.max(list.start, ...values)).length.toString());
        }
      }),
    [editor],
  );

  return null;
}
