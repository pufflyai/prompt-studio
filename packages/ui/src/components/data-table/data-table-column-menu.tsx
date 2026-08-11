import { Box, HStack, Icon, IconButton, Popover, Portal, Stack, Text } from "@chakra-ui/react";
import { closestCenter, DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check, GripVertical, Settings2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { SearchableMenuInput } from "@/components/overlays/searchable-menu-input";
import { Checkbox } from "@/components/primitives/checkbox";
import { ScrollArea } from "@/components/primitives/scroll-area";
import { Switch } from "@/components/primitives/switch";

interface DataTableColumnMenuColumn {
  id: string;
  label: string;
}

interface DataTableColumnMenuProps {
  columns: DataTableColumnMenuColumn[];
  visibleColumnIds: Set<string>;
  showStats: boolean;
  statsAvailable: boolean;
  onColumnVisibilityChange: (columnId: string, visible: boolean) => void;
  onColumnReorder: (activeColumnId: string, overColumnId: string) => void;
  onStatsVisibilityChange: (showStats: boolean) => void;
}

interface DataTableColumnMenuRowProps {
  column: DataTableColumnMenuColumn;
  checked: boolean;
  onColumnVisibilityChange: (columnId: string, visible: boolean) => void;
}

const DataTableColumnMenuRow = (props: DataTableColumnMenuRowProps) => {
  const { column, checked, onColumnVisibilityChange } = props;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: column.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <HStack
      ref={setNodeRef}
      style={style}
      gap="2xs"
      minW="0"
      width="full"
      borderRadius="xs"
      px="xs"
      py="2xs"
      _hover={{ bg: "bg.hover" }}
    >
      <Box as="span" display="inline-flex" cursor="grab" color="fg.muted" {...attributes} {...listeners}>
        <GripVertical size={14} />
      </Box>
      <Checkbox
        checked={checked}
        flex="1"
        minW="0"
        width="full"
        flexDirection="row-reverse"
        justifyContent="space-between"
        size="sm"
        icon={<Icon as={Check} boxSize="12px" strokeWidth="3" />}
        onCheckedChange={(details) => onColumnVisibilityChange(column.id, details.checked === true)}
      >
        <Text as="span" textStyle="label/S/regular" truncate>
          {column.label}
        </Text>
      </Checkbox>
    </HStack>
  );
};

export const DataTableColumnMenu = (props: DataTableColumnMenuProps) => {
  const {
    columns,
    visibleColumnIds,
    showStats,
    statsAvailable,
    onColumnVisibilityChange,
    onColumnReorder,
    onStatsVisibilityChange,
  } = props;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const normalizedQuery = query.trim().toLowerCase();
  const filteredColumns = normalizedQuery
    ? columns.filter((column) => column.label.toLowerCase().includes(normalizedQuery))
    : columns;

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    onColumnReorder(String(active.id), String(over.id));
  };

  useEffect(() => {
    if (!open) return;

    const closeOnOutsidePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (contentRef.current?.contains(target) || triggerRef.current?.contains(target)) return;

      setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", closeOnOutsidePointerDown);
    document.addEventListener("keydown", closeOnEscape, true);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointerDown);
      document.removeEventListener("keydown", closeOnEscape, true);
    };
  }, [open]);

  return (
    <Popover.Root
      open={open}
      closeOnInteractOutside={false}
      positioning={{
        placement: "bottom-end",
        offset: { mainAxis: 8 },
        getAnchorElement: () => triggerRef.current,
      }}
    >
      <Popover.Trigger asChild>
        <IconButton
          ref={triggerRef}
          aria-label="Display settings"
          variant="ghost"
          size="sm"
          onClick={() => setOpen((current) => !current)}
        >
          <Icon as={Settings2} boxSize="14px" />
        </IconButton>
      </Popover.Trigger>
      <Portal>
        <Popover.Positioner>
          <Popover.Content ref={contentRef} width="min(320px, calc(100vw - 32px))" p="0" bg="bg" overflow="hidden">
            <Stack gap="0">
              {statsAvailable ? (
                <Box borderBottomWidth="1px" borderColor="border.subtle" padding="xs">
                  <Switch
                    checked={showStats}
                    inputProps={{ role: "switch" }}
                    width="full"
                    flexDirection="row-reverse"
                    justifyContent="space-between"
                    onCheckedChange={(details) => onStatsVisibilityChange(details.checked === true)}
                  >
                    <Text as="span" textStyle="label/S/regular">
                      Statistics
                    </Text>
                  </Switch>
                </Box>
              ) : null}
              <SearchableMenuInput value={query} placeholder="Search columns" onValueChange={setQuery} />
              <ScrollArea maxH="280px" viewportProps={{ overscrollBehavior: "contain" }}>
                <Box padding="2xs">
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={columns.map((column) => column.id)} strategy={verticalListSortingStrategy}>
                      <Stack gap="1px">
                        {filteredColumns.map((column) => (
                          <DataTableColumnMenuRow
                            key={column.id}
                            column={column}
                            checked={visibleColumnIds.has(column.id)}
                            onColumnVisibilityChange={onColumnVisibilityChange}
                          />
                        ))}
                      </Stack>
                    </SortableContext>
                  </DndContext>
                </Box>
              </ScrollArea>
            </Stack>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
};
