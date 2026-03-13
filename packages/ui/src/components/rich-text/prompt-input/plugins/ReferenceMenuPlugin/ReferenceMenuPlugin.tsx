import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { LexicalTypeaheadMenuPlugin } from "@lexical/react/LexicalTypeaheadMenuPlugin";
import type { TextNode } from "lexical";
import { useState } from "react";
import * as ReactDOM from "react-dom";
import { INSERT_REFERENCE_COMMAND } from "../../commands";
import { ReferenceMenu } from "./components/ReferenceMenu/ReferenceMenu";
import { useContextLookup } from "./hooks/useContextLookup";
import type { ReferenceMenuOption } from "./ReferenceMenuOption";
import { checkForTriggers } from "./utils/checkForTriggers";

const SUGGESTION_LIST_LENGTH_LIMIT = 20;

type Props = {
  items?: Array<{
    resourceId: string;
    resourceType: "table" | "connector";
    name: string;
    description?: string;
  }>;
};

export function ReferenceMenuPlugin({ items = [] }: Props) {
  const [queryString, setQueryString] = useState<string | null>(null);
  const [editor] = useLexicalComposerContext();
  const searchResults = useContextLookup(queryString, items);

  /**
   * triggers when the user selects an option in the context menu
   */
  const onSelectOption = (
    selectedOption: ReferenceMenuOption,
    nodeToReplace: TextNode | null,
    closeMenu: () => void,
  ) => {
    editor.update(() => {
      if (!nodeToReplace) return;

      editor.dispatchCommand(INSERT_REFERENCE_COMMAND, {
        resourceId: selectedOption.id,
        resourceType: selectedOption.group,
        name: selectedOption.name,
        nodeToReplace,
      });

      closeMenu();
    });
  };

  /**
   * checks text nodes and return nodes matching the trigger
   */
  const checkForTrigger = (text: string) => {
    return checkForTriggers(text, 0);
  };

  /**
   * define the options to display in the context menu
   */
  const menuOptions = searchResults.slice(0, SUGGESTION_LIST_LENGTH_LIMIT);

  return (
    <LexicalTypeaheadMenuPlugin<ReferenceMenuOption>
      onQueryChange={setQueryString}
      onSelectOption={onSelectOption}
      triggerFn={checkForTrigger}
      options={menuOptions}
      menuRenderFn={(anchorElementRef, { options, selectedIndex, selectOptionAndCleanUp, setHighlightedIndex }) => {
        if (!anchorElementRef.current) return null;
        return ReactDOM.createPortal(
          <ReferenceMenu
            options={options}
            selectedIndex={selectedIndex}
            onSelectItem={(option, i) => {
              setHighlightedIndex(i);
              selectOptionAndCleanUp(option);
            }}
            onMouseEnterItem={(i) => {
              setHighlightedIndex(i);
            }}
          />,
          anchorElementRef.current,
        );
      }}
    />
  );
}
