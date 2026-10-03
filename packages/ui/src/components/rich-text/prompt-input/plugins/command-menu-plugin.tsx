import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { LexicalTypeaheadMenuPlugin, MenuOption } from "@lexical/react/LexicalTypeaheadMenuPlugin";
import { $createTextNode, $getRoot, $getSelection, $isRangeSelection, $setSelection } from "lexical";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ListRow } from "@/components/list-row/list-row";
import { ScrollArea } from "@/components/primitives/scroll-area";
import { SimpleCard } from "@/components/primitives/simple-card";

export interface PromptCommand {
  name: string;
  description: string;
  argumentHelp?: string;
}

class CommandOption extends MenuOption {
  readonly command: PromptCommand;
  constructor(command: PromptCommand) {
    super(command.name);
    this.command = command;
  }
}

interface CommandMenuProps {
  options: CommandOption[];
  selectedIndex: number | null;
  onSelect: (option: CommandOption, index: number) => void;
  onHighlight: (index: number) => void;
}

const CommandMenu = (props: CommandMenuProps) => {
  const { options, selectedIndex, onSelect, onHighlight } = props;
  useEffect(() => {
    options[selectedIndex ?? -1]?.ref?.current?.scrollIntoView({ block: "nearest" });
  }, [options, selectedIndex]);
  return (
    <SimpleCard position="absolute" bottom="100%" mb="lg" minW="xs" maxW="sm" zIndex="popover" layerStyle="modal">
      <ScrollArea maxH="xs" showHorizontalScrollbar={false}>
        {options.map((option, index) => (
          <ListRow
            key={option.key}
            id={`typeahead-item-${index}`}
            ref={option.setRefElement}
            role="option"
            tabIndex={-1}
            variant="full-width"
            label={option.command.name}
            description={[option.command.description, option.command.argumentHelp].filter(Boolean).join(" ")}
            isSelected={selectedIndex === index}
            onMouseDown={(event) => event.preventDefault()}
            onPointerMove={() => onHighlight(index)}
            onActivate={() => onSelect(option, index)}
          />
        ))}
      </ScrollArea>
    </SimpleCard>
  );
};

export const CommandMenuPlugin = (props: { commands: PromptCommand[] }) => {
  const { commands } = props;
  const [editor] = useLexicalComposerContext();
  const [query, setQuery] = useState<string | null>(null);
  useEffect(() => {
    // Discovery can finish after typing. A new catalog refreshes the existing selection.
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
        const selection = $getSelection();
        if (!$isRangeSelection(selection) || selection.anchor.getNode() !== $getRoot().getFirstDescendant())
          return null;
        if (!/^\/[^\s/]*$/.test(text) || !commands.some((command) => command.name.startsWith(text))) return null;
        return { leadOffset: 0, matchingString: text.slice(1), replaceableString: text };
      }}
      onSelectOption={(option, node, closeMenu) => {
        editor.update(() => {
          node?.replace($createTextNode(`${option.command.name} `)).selectEnd();
          closeMenu();
        });
      }}
      menuRenderFn={(anchor, { options, selectedIndex, selectOptionAndCleanUp, setHighlightedIndex }) =>
        anchor.current
          ? createPortal(
              <CommandMenu
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
          : null
      }
    />
  );
};
