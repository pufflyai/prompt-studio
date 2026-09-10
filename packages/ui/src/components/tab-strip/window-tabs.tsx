import { createSlotRecipeContext, type HTMLChakraProps } from "@chakra-ui/react";
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import {
  horizontalListSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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
  onReorder?: (id: string, targetId: string) => void;
  "aria-label": string;
}

interface WindowTabItemProps {
  tab: WindowTab;
  selected: boolean;
  tabIndex: number;
  reorderable: boolean;
  onSelect: () => void;
  onClose: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
}

const WindowTabItem = (props: WindowTabItemProps) => {
  const { tab, selected, tabIndex, reorderable, onSelect, onClose, onKeyDown } = props;
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging, isSorting } =
    useSortable({ id: tab.id, disabled: !reorderable });
  return (
    <Tab
      ref={setNodeRef}
      role="presentation"
      data-selected={selected ? "" : undefined}
      data-dragging={isDragging ? "" : undefined}
      transform={CSS.Translate.toString(transform)}
      transition={transition}
    >
      <Trigger
        {...(reorderable ? attributes : {})}
        {...listeners}
        ref={setActivatorNodeRef}
        type="button"
        role="tab"
        aria-selected={selected}
        aria-label={tab.label}
        tabIndex={tabIndex}
        title={tab.label}
        onClick={onSelect}
        onKeyDown={(event) => {
          listeners?.onKeyDown?.(event);
          if (!isSorting && !event.defaultPrevented) onKeyDown(event);
        }}
      >
        {tab.icon}
        <Label>{tab.label}</Label>
      </Trigger>
      <Close type="button" aria-label={`Close ${tab.label}`} title={`Close ${tab.label}`} onClick={onClose}>
        <X aria-hidden="true" />
      </Close>
    </Tab>
  );
};

export const WindowTabs = (props: WindowTabsProps) => {
  const { tabs, selectedId, onSelect, onClose, onReorder, "aria-label": label } = props;
  const listRef = useRef<HTMLDivElement>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
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
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[({ transform }) => ({ ...transform, y: 0 })]}
      onDragEnd={({ active, over }) => {
        if (over && active.id !== over.id) onReorder?.(String(active.id), String(over.id));
      }}
    >
      <SortableContext items={tabs.map((tab) => tab.id)} strategy={horizontalListSortingStrategy}>
        <List ref={listRef} role="tablist" aria-label={label}>
          {tabs.map((tab, index) => (
            <WindowTabItem
              key={tab.id}
              tab={tab}
              selected={tab.id === selectedId}
              tabIndex={tab.id === (selectedId ?? tabs[0]?.id) ? 0 : -1}
              reorderable={Boolean(onReorder)}
              onSelect={() => onSelect(tab.id)}
              onClose={() => closeTab(index)}
              onKeyDown={(event) => handleKey(event, index)}
            />
          ))}
        </List>
      </SortableContext>
    </DndContext>
  );
};
