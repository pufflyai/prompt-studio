import { Box, HStack, Icon, IconButton, Input, Popover, Portal, Stack, Text } from "@chakra-ui/react";
import { closestCenter, DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check, Columns3, GripVertical, Search } from "lucide-react";
import { useState } from "react";

import { Checkbox } from "@/components/primitives/checkbox";
import { ScrollArea } from "@/components/primitives/scroll-area";

interface DataTableColumnMenuColumn {
  id: string;
  label: string;
}

interface DataTableColumnMenuProps {
  columns: DataTableColumnMenuColumn[];
  visibleColumnIds: Set<string>;
  onColumnToggle: (columnId: string) => void;
  onColumnReorder: (activeColumnId: string, overColumnId: string) => void;
}

interface DataTableColumnMenuRowProps {
  column: DataTableColumnMenuColumn;
  checked: boolean;
  onColumnToggle: (columnId: string) => void;
}

const DataTableColumnMenuRow = (props: DataTableColumnMenuRowProps) => {
  const { column, checked, onColumnToggle } = props;
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
        size="sm"
        icon={<Icon as={Check} boxSize="12px" strokeWidth="3" />}
        onCheckedChange={() => onColumnToggle(column.id)}
      >
        <Text as="span" textStyle="label/S/regular" truncate>
          {column.label}
        </Text>
      </Checkbox>
    </HStack>
  );
};

export const DataTableColumnMenu = (props: DataTableColumnMenuProps) => {
  const { columns, visibleColumnIds, onColumnToggle, onColumnReorder } = props;
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

  return (
    <Popover.Root positioning={{ placement: "bottom-end", offset: { mainAxis: 8 } }}>
      <Popover.Trigger asChild>
        <IconButton aria-label="Manage columns" variant="ghost" size="sm">
          <Icon as={Columns3} boxSize="14px" />
        </IconButton>
      </Popover.Trigger>
      <Portal>
        <Popover.Positioner>
          <Popover.Content width="min(320px, calc(100vw - 32px))" p="0" bg="bg" overflow="hidden">
            <Stack gap="0">
              <HStack borderBottomWidth="1px" borderColor="border.subtle" padding="xs" gap="2xs">
                <Icon as={Search} boxSize="14px" color="fg.muted" />
                <Input
                  size="xs"
                  variant="flushed"
                  placeholder="Search columns"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </HStack>
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
                            onColumnToggle={onColumnToggle}
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
