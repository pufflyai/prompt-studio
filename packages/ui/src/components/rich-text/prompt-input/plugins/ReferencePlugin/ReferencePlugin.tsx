import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { mergeRegister } from "@lexical/utils";
import { COMMAND_PRIORITY_LOW, type LexicalNode } from "lexical";
import { type PropsWithChildren, useEffect } from "react";
import { INSERT_REFERENCE_COMMAND } from "../../commands";
import type { ReferenceResourceType } from "../../prompt-input";
import { $createReferenceNode } from "./nodes/ReferenceNode/ReferenceNode";

export const $insertExistingReference = (nodeToReplace: LexicalNode, resourceId: string, name: string) => {
  const refNode = $createReferenceNode(resourceId, name);

  if (nodeToReplace) {
    nodeToReplace?.replace(refNode);
    nodeToReplace.remove();
    refNode.selectEnd();
    return;
  }
};

export function ReferencePlugin(
  props: PropsWithChildren<{ onAddReference?: (resourceId: string, resourceType: ReferenceResourceType) => void }>,
) {
  const { onAddReference } = props;
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return mergeRegister(
      editor.registerCommand(
        INSERT_REFERENCE_COMMAND,
        (event: {
          resourceId: string;
          resourceType: ReferenceResourceType;
          name: string;
          nodeToReplace: LexicalNode;
        }) => {
          const { resourceId, resourceType, name, nodeToReplace } = event;

          editor.update(() => {
            $insertExistingReference(nodeToReplace, resourceId, name);
          });

          onAddReference?.(resourceId, resourceType);
          return true;
        },
        COMMAND_PRIORITY_LOW,
      ),
    );
  }, [editor, onAddReference]);

  return null;
}
