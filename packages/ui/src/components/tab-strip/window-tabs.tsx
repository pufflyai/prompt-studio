import { Box, createSlotRecipeContext, type HTMLChakraProps } from "@chakra-ui/react";
import {
  closestCenter,
  DndContext,
  type DragOverEvent,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { X } from "lucide-react";
import { type KeyboardEvent, type ReactNode, useEffect, useRef, useState } from "react";
import { DropIndicator } from "@/components/primitives/drop-indicator";
import { ScrollArea } from "@/components/primitives/scroll-area";
import { Tooltip } from "@/components/primitives/tooltip";
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
  dropEdge?: "before" | "after";
  onSelect: () => void;
  onClose: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
}

const WindowTabItem = (props: WindowTabItemProps) => {
  const { tab, selected, tabIndex, reorderable, dropEdge, onSelect, onClose, onKeyDown } = props;
  const labelRef = useRef<HTMLSpanElement>(null);
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging, isSorting } = useSortable({
    id: tab.id,
    disabled: !reorderable,
  });
  return (
    <Tab
      ref={setNodeRef}
      role="presentation"
      data-selected={selected ? "" : undefined}
      data-dragging={isDragging ? "" : undefined}
    >
      <Tooltip
        content={tab.label}
        open={isSorting ? false : undefined}
        overflowRef={labelRef}
        closeDelay={150}
        positioning={{ placement: "bottom" }}
      >
        <Trigger
          {...(reorderable ? attributes : {})}
          {...listeners}
          ref={setActivatorNodeRef}
          type="button"
          role="tab"
          aria-selected={selected}
          aria-label={tab.label}
          aria-keyshortcuts={reorderable ? "Alt+ArrowLeft Alt+ArrowRight" : undefined}
          tabIndex={tabIndex}
          onClick={onSelect}
          onKeyDown={(event) => {
            listeners?.onKeyDown?.(event);
            if (!isSorting && !event.defaultPrevented) onKeyDown(event);
          }}
        >
          {tab.icon}
          <Label ref={labelRef}>{tab.label}</Label>
        </Trigger>
      </Tooltip>
      <Close type="button" aria-label={`Close ${tab.label}`} title={`Close ${tab.label}`} onClick={onClose}>
        <X aria-hidden="true" />
      </Close>
      {dropEdge ? (
        <DropIndicator
          data-window-tab-drop={dropEdge}
          orientation="vertical"
          left={dropEdge === "before" ? "0" : undefined}
          right={dropEdge === "after" ? "0" : undefined}
        />
      ) : null}
    </Tab>
  );
};

export const WindowTabs = (props: WindowTabsProps) => {
  const { tabs, selectedId, onSelect, onClose, onReorder, "aria-label": label } = props;
  const listRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [activeId, setActiveId] = useState<string>();
  const [drop, setDrop] = useState<{ id: string; targetId: string; edge: "before" | "after" }>();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const resolveDrop = (event: DragOverEvent) => {
    if (!event.over || event.active.id === event.over.id) return;
    const id = String(event.active.id);
    const targetId = String(event.over.id);
    const from = tabs.findIndex((tab) => tab.id === id);
    const remaining = tabs.filter((tab) => tab.id !== id);
    const rect = event.active.rect.current.translated;
    let before = tabs.findIndex((tab) => tab.id === targetId) < from;
    if (rect && event.activatorEvent.type !== "keydown") {
      const center = rect.left + rect.width / 2;
      const targetCenter = event.over.rect.left + event.over.rect.width / 2;
      // A center drop keeps the original sortable behavior in either direction.
      if (center !== targetCenter) before = center < targetCenter;
    }
    const index = remaining.findIndex((tab) => tab.id === targetId) + (before ? 0 : 1);
    if (index === from) return;
    // The public callback moves to the target's original index.
    return {
      id: String(event.over.id),
      targetId: tabs[index].id,
      edge: before ? ("before" as const) : ("after" as const),
    };
  };
  const finishDrag = () => {
    setActiveId(undefined);
    setDrop(undefined);
  };
  useEffect(() => {
    if (!selectedId || activeId) return;
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [selectedId, activeId]);

  const closeTab = (index: number) => {
    const triggers = listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    const neighbor = triggers?.[index + 1] ?? triggers?.[index - 1];
    onClose(tabs[index].id);
    neighbor?.focus();
  };

  const handleKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.altKey && onReorder && ["ArrowLeft", "ArrowRight"].includes(event.key)) {
      event.preventDefault();
      const neighbor = tabs[index + (event.key === "ArrowLeft" ? -1 : 1)];
      if (neighbor) onReorder(tabs[index].id, neighbor.id);
      const tab = event.currentTarget;
      requestAnimationFrame(() => tab.scrollIntoView({ block: "nearest", inline: "nearest" }));
      return;
    }
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
      collisionDetection={(args) => {
        const pointer = args.pointerCoordinates;
        if (!pointer) return closestCenter(args);
        const viewport = viewportRef.current?.getBoundingClientRect();
        if (
          !viewport ||
          pointer.x < viewport.left ||
          pointer.x > viewport.right ||
          pointer.y < viewport.top ||
          pointer.y > viewport.bottom
        )
          return [];
        return pointerWithin(args);
      }}
      onDragStart={({ active }) => setActiveId(String(active.id))}
      onDragOver={(event) => setDrop(resolveDrop(event))}
      onDragMove={(event) => setDrop(resolveDrop(event))}
      onDragCancel={finishDrag}
      onDragEnd={(event) => {
        const target = resolveDrop(event);
        finishDrag();
        if (target) onReorder?.(String(event.active.id), target.targetId);
      }}
    >
      <SortableContext items={tabs.map((tab) => tab.id)} strategy={() => null}>
        {/* Match panel tabs' scroll content sizing; see ADR 0049. */}
        <ScrollArea
          viewportRef={viewportRef}
          width="fit-content"
          minW="0"
          maxW="full"
          height="window-tab"
          showVerticalScrollbar={false}
          showHorizontalScrollbar
          contentProps={{ h: "full", w: "full", minW: "0!" }}
        >
          <List ref={listRef} role="tablist" aria-label={label}>
            {tabs.map((tab, index) => (
              <WindowTabItem
                key={tab.id}
                tab={tab}
                selected={tab.id === selectedId}
                tabIndex={tab.id === (selectedId ?? tabs[0]?.id) ? 0 : -1}
                reorderable={Boolean(onReorder)}
                dropEdge={drop?.id === tab.id ? drop.edge : undefined}
                onSelect={() => onSelect(tab.id)}
                onClose={() => closeTab(index)}
                onKeyDown={(event) => handleKey(event, index)}
              />
            ))}
          </List>
        </ScrollArea>
      </SortableContext>
      <Box asChild pointerEvents="none">
        <DragOverlay
          dropAnimation={null}
          modifiers={[
            ({ transform, activeNodeRect }) => {
              const viewport = viewportRef.current?.getBoundingClientRect();
              if (!viewport || !activeNodeRect) return transform;
              return {
                ...transform,
                x: Math.max(
                  viewport.left - activeNodeRect.left,
                  Math.min(transform.x, viewport.right - activeNodeRect.right),
                ),
                y: 0,
              };
            },
          ]}
        >
          {activeId ? (
            <Box layerStyle="floatingBar" textStyle="label/XS/medium" maxW="full" truncate>
              {tabs.find((tab) => tab.id === activeId)?.label}
            </Box>
          ) : null}
        </DragOverlay>
      </Box>
    </DndContext>
  );
};
