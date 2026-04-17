import { $isListNode } from "@lexical/list";
import { $isHeadingNode } from "@lexical/rich-text";
import { $findMatchingParent } from "@lexical/utils";
import { $isRootOrShadowRoot, type LexicalNode } from "lexical";

export const blockTypeToBlockName = {
  bullet: "Bulleted List",
  check: "Check List",
  code: "Code Block",
  h1: "Heading 1",
  h2: "Heading 2",
  h3: "Heading 3",
  h4: "Heading 4",
  h5: "Heading 5",
  h6: "Heading 6",
  number: "Numbered List",
  paragraph: "Normal",
  quote: "Quote",
};

export type BlockType = keyof typeof blockTypeToBlockName;

const toKnownBlockType = (type: string) => {
  return type in blockTypeToBlockName ? (type as BlockType) : null;
};

const findSelectionElement = (anchorNode: LexicalNode) => {
  const rootMatch =
    anchorNode.getKey() === "root"
      ? anchorNode
      : $findMatchingParent(anchorNode, (node) => {
          const parent = node.getParent();
          return parent !== null && $isRootOrShadowRoot(parent);
        });

  return rootMatch ?? anchorNode.getTopLevelElementOrThrow();
};

export const resolveBlockTypeFromAnchor = (anchorNode: LexicalNode) => {
  const element = findSelectionElement(anchorNode);

  if ($isListNode(element)) {
    return element.getListType() as BlockType;
  }

  const parentList = $findMatchingParent(anchorNode, (node) => $isListNode(node));
  if (parentList !== null && $isListNode(parentList)) {
    return parentList.getListType() as BlockType;
  }

  const type = $isHeadingNode(element) ? element.getTag() : element.getType();
  return toKnownBlockType(type);
};
