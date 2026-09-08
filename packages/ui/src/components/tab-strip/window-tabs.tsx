import { createSlotRecipeContext, type HTMLChakraProps } from "@chakra-ui/react";
import { X } from "lucide-react";
import { type KeyboardEvent, type ReactNode, useEffect, useRef } from "react";
import { windowTabsRecipe as recipe } from "@/theme/recipes/window-title-bar";

const { withProvider, withContext } = createSlotRecipeContext({ recipe });
const List = withProvider<HTMLDivElement, HTMLChakraProps<"div">>("div", "list");
const Tab = withContext<HTMLDivElement, HTMLChakraProps<"div">>("div", "tab");
const Trigger = withContext<HTMLButtonElement, HTMLChakraProps<"button">>("button", "trigger");
const Label = withContext<HTMLSpanElement, HTMLChakraProps<"span">>("span", "label");
const Close = withContext<HTMLButtonElement, HTMLChakraProps<"button">>("button", "close");

export interface WindowTab {
  id: string;
  label: string;
  icon?: ReactNode;
}

export interface WindowTabsProps {
  tabs: WindowTab[];
  selectedId?: string;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  "aria-label": string;
}

export const WindowTabs = (props: WindowTabsProps) => {
  const { tabs, selectedId, onSelect, onClose, "aria-label": label } = props;
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!selectedId) return;
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [selectedId]);

  const closeTab = (index: number) => {
    const triggers = listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    const neighbor = triggers?.[index + 1] ?? triggers?.[index - 1];
    onClose(tabs[index].id);
    neighbor?.focus();
  };

  const handleKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    else if (event.key === "Delete") {
      event.preventDefault();
      closeTab(index);
      return;
    } else return;
    event.preventDefault();
    listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
    onSelect(tabs[next].id);
  };

  return (
    <List ref={listRef} role="tablist" aria-label={label}>
      {tabs.map((tab, index) => (
        <Tab key={tab.id} role="presentation" data-selected={tab.id === selectedId ? "" : undefined}>
          <Trigger
            type="button"
            role="tab"
            aria-selected={tab.id === selectedId}
            aria-label={tab.label}
            tabIndex={tab.id === (selectedId ?? tabs[0]?.id) ? 0 : -1}
            title={tab.label}
            onClick={() => onSelect(tab.id)}
            onKeyDown={(event) => handleKey(event, index)}
          >
            {tab.icon}
            <Label>{tab.label}</Label>
          </Trigger>
          <Close
            type="button"
            aria-label={`Close ${tab.label}`}
            title={`Close ${tab.label}`}
            onClick={() => closeTab(index)}
          >
            <X aria-hidden="true" />
          </Close>
        </Tab>
      ))}
    </List>
  );
};
