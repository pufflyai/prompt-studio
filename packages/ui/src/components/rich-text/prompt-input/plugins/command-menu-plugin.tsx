import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { LexicalTypeaheadMenuPlugin, MenuOption } from "@lexical/react/LexicalTypeaheadMenuPlugin";
import { $createTextNode, $getSelection, $setSelection } from "lexical";
import { type RefObject, useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { ScrollArea } from "@/components/primitives/scroll-area";
import { useTypeaheadScope } from "../../shared/use-typeahead-scope";
import { matchCommandQuery } from "./command-query";

export interface PromptCommand {
  name: string;
  description: string;
  argumentHelp?: string;
  disabledReason?: string;
  /** Select local draft intent without inserting native command text. */
  onSelect?: () => void;
}

class CommandOption extends MenuOption {
  readonly command: PromptCommand;
  constructor(command: PromptCommand) {
    super(command.name);
    this.command = command;
  }
}

interface CommandMenuProps {
  anchor: RefObject<HTMLElement | null>;
  options: CommandOption[];
  selectedIndex: number | null;
  onSelect: (option: CommandOption, index: number) => void;
  onHighlight: (index: number) => void;
}

const CommandMenu = (props: CommandMenuProps) => {
  const active = useTypeaheadScope(props.anchor);
  const menuId = useId();
  const { options, selectedIndex, onSelect, onHighlight } = props;
  const styles = useSlotRecipe({ key: "menu" })({ variant: "commands" });
  useEffect(() => {
    options[selectedIndex ?? -1]?.ref?.current?.scrollIntoView({ block: "nearest" });
  }, [options, selectedIndex]);
  return (
    <Box css={styles.content} position="absolute" bottom="100%" mb="2xs" zIndex="popover">
      <ScrollArea maxH="xs" showHorizontalScrollbar={false}>
        {options.map((option, index) => (
          <chakra.button
            key={option.key}
            id={active ? `typeahead-item-${index}` : `${menuId}-typeahead-item-${index}`}
            ref={option.setRefElement}
            role="option"
            type="button"
            aria-label={option.command.name}
            aria-describedby={`${menuId}-description-${index}`}
            aria-disabled={Boolean(option.command.disabledReason)}
            tabIndex={-1}
            css={styles.item}
            disabled={Boolean(option.command.disabledReason)}
            aria-selected={selectedIndex === index}
            data-highlighted={selectedIndex === index && !option.command.disabledReason ? "" : undefined}
            onMouseDown={(event) => event.preventDefault()}
            onPointerMove={() => onHighlight(index)}
            onClick={() => onSelect(option, index)}
          >
            <Text as="span" css={styles.itemText} truncate>
              {option.command.name}
            </Text>
            <Text
              as="span"
              id={`${menuId}-description-${index}`}
              css={styles.itemCommand}
              data-command-description
              truncate
            >
              {option.command.disabledReason ?? option.command.description}
            </Text>
          </chakra.button>
        ))}
      </ScrollArea>
    </Box>
  );
};

export const CommandMenuPlugin = (props: { commands: PromptCommand[] }) => {
  const { commands } = props;
  const [editor] = useLexicalComposerContext();
  const [query, setQuery] = useState<string | null>(null);
  useEffect(() => {
    // Refresh completion after discovery only while the editor owns focus.
    const root = editor.getRootElement();
    if (!root?.contains(root.ownerDocument.activeElement)) return;
    editor.update(() => {
      const selection = $getSelection();
      if (selection) $setSelection(selection.clone());
    });
  }, [editor]);
  const matches = commands.filter((command) => command.name.startsWith(`/${query ?? ""}`));
  const options = matches.map((command) => new CommandOption(command));
  return (
    <LexicalTypeaheadMenuPlugin<CommandOption>
      onQueryChange={setQuery}
      options={options}
      triggerFn={(text) => {
        const match = matchCommandQuery(text);
        if (!match || !commands.some((command) => command.name.startsWith(`/${match.matchingString}`))) return null;
        return match;
      }}
      onSelectOption={(option, node, closeMenu) => {
        if (option.command.disabledReason) return;
        editor.update(() => {
          node?.replace($createTextNode(option.command.onSelect ? "" : `${option.command.name} `)).selectEnd();
          closeMenu();
        });
        option.command.onSelect?.();
      }}
      menuRenderFn={(anchor, { options, selectedIndex, selectOptionAndCleanUp, setHighlightedIndex }) => {
        anchor.current?.setAttribute("aria-label", "Harness commands");
        return anchor.current
          ? createPortal(
              <CommandMenu
                anchor={anchor}
                options={options}
                selectedIndex={selectedIndex}
                onHighlight={setHighlightedIndex}
                onSelect={(option, index) => {
                  setHighlightedIndex(index);
                  selectOptionAndCleanUp(option);
                }}
              />,
              anchor.current,
            )
          : null;
      }}
    />
  );
};

import { Box, chakra, Text, useSlotRecipe } from "@chakra-ui/react";
