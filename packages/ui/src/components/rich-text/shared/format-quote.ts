import { $createQuoteNode, $isQuoteNode } from "@lexical/rich-text";
import { $unwrapNode } from "@lexical/utils";
import { $isRootNode, type RangeSelection } from "lexical";

export function $formatQuote(selection: RangeSelection, isQuote: boolean) {
  const blocks = new Set(
    selection
      .getNodes()
      .filter((node) => !$isRootNode(node))
      .map((node) => node.getTopLevelElementOrThrow()),
  );

  for (const block of blocks) {
    if (isQuote) {
      if ($isQuoteNode(block)) $unwrapNode(block);
      continue;
    }
    if ($isQuoteNode(block)) continue;

    // Quotes contain blocks, just as they do when imported from Markdown.
    const previous = block.getPreviousSibling();
    const quote = $isQuoteNode(previous) ? previous : block.insertBefore($createQuoteNode());
    quote.append(block);
  }
}
