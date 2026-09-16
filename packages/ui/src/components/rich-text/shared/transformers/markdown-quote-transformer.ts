import { type ElementTransformer, QUOTE as LEXICAL_QUOTE } from "@lexical/markdown";
import { $createQuoteNode, $isQuoteNode } from "@lexical/rich-text";
import { $createLineBreakNode, $createParagraphNode, $isParagraphNode } from "lexical";

export const QUOTE: ElementTransformer = {
  ...LEXICAL_QUOTE,
  replace: (parent, children, _match, isImport) => {
    const previous = parent.getPreviousSibling();
    const previousParagraph = $isQuoteNode(previous) ? previous.getLastChild() : null;
    if (isImport && $isParagraphNode(previousParagraph)) {
      previousParagraph.append($createLineBreakNode(), ...children);
      parent.remove();
      return;
    }

    // Match the Markdown importer's block structure so Enter stays inside the quote.
    const paragraph = $createParagraphNode().append(...children);
    parent.replace($createQuoteNode().append(paragraph));
    if (!isImport) paragraph.selectStart();
  },
};
