import { $isLinkNode } from "@lexical/link";
import { $findMatchingParent } from "@lexical/utils";
import type { RangeSelection } from "lexical";
import { getSelectedNode } from "./getSelectedNode";

export function getSelectionLinkUrl(selection: RangeSelection) {
  const node = getSelectedNode(selection);
  const linkParent = $findMatchingParent(node, $isLinkNode);

  if (linkParent) {
    return linkParent.getURL();
  }
  if ($isLinkNode(node)) {
    return node.getURL();
  }
  return "";
}
