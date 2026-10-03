import { Box, Button, HStack, Icon, IconButton, Stack, Text } from "@chakra-ui/react";
import { closestCenter, DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ViewSort, ViewSortDirection } from "@pstdio/sdk/extensions";
import { GripVertical, Plus, Trash2, X } from "lucide-react";
import type { AttributeDescriptor } from "../kanban-renderer/types";
import { fieldIcon } from "./collection-view-field-icon";
import { findField } from "./collection-view-fields";
import { sortDirectionLabel } from "./collection-view-labels";
import { RuleSelect } from "./rule-select";

export interface ViewSortMenuProps {
  /** The sortable fields, in menu order. */
  fields: AttributeDescriptor[];
  sorts: ViewSort[];
  onChange: (sorts: ViewSort[]) => void;
}

interface SortRuleRowProps {
  fields: AttributeDescriptor[];
  sort: ViewSort;
  usedIds: string[];
  onChange: (sort: ViewSort) => void;
  onRemove: () => void;
}

const SortRuleRow = (props: SortRuleRowProps) => {
  const { fields, sort, usedIds, onChange, onRemove } = props;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: sort.attributeId,
  });
  const field = findField(fields, sort.attributeId);

  return (
    <HStack
      ref={setNodeRef}
      data-testid="sort-rule-row"
      gap="xs"
      minH="1.75rem"
      opacity={isDragging ? 0.5 : 1}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <Box
        as="span"
        aria-label="Reorder sort"
        display="inline-flex"
        cursor="grab"
        color="fg.subtle"
        {...attributes}
        {...listeners}
      >
        <Icon as={GripVertical} boxSize="0.875rem" />
      </Box>
      <RuleSelect
        aria-label="Sort field"
        width="9.5rem"
        options={fields.map((entry) => ({
          value: entry.id,
          label: entry.label,
          icon: fieldIcon(entry),
          disabled: entry.id !== sort.attributeId && usedIds.includes(entry.id),
        }))}
        value={sort.attributeId}
        onSelect={(attributeId) => onChange({ ...sort, attributeId })}
      />
      <RuleSelect
        aria-label="Sort direction"
        width="8.5rem"
        options={(["asc", "desc"] as const).map((direction) => ({
          value: direction,
          label: sortDirectionLabel(field, direction),
        }))}
        value={sort.direction}
        onSelect={(direction) => onChange({ ...sort, direction: direction as ViewSortDirection })}
      />
      <IconButton aria-label="Remove sort" variant="ghost" size="2xs" marginLeft="auto" onClick={onRemove}>
        <Icon as={X} />
      </IconButton>
    </HStack>
  );
};

/** Sort levels in priority order: the top row sorts first. */
export const ViewSortMenu = (props: ViewSortMenuProps) => {
  const { fields, sorts, onChange } = props;
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const usedIds = sorts.map((sort) => sort.attributeId);
  const nextField = fields.find((field) => !usedIds.includes(field.id));
  const change = (index: number, sort: ViewSort) =>
    onChange(sorts.map((entry, entryIndex) => (entryIndex === index ? sort : entry)));
  const remove = (index: number) => onChange(sorts.filter((_, entryIndex) => entryIndex !== index));
  const handleDragEnd = (event: DragEndEvent) => {
    const from = usedIds.indexOf(String(event.active.id));
    const to = event.over ? usedIds.indexOf(String(event.over.id)) : -1;
    if (from >= 0 && to >= 0 && from !== to) onChange(arrayMove(sorts, from, to));
  };

  return (
    <Stack data-testid="view-sort-menu" gap="2xs" minW="0">
      <Text paddingX="xs" paddingTop="xs" textStyle="label/XS/medium" color="fg.muted">
        SORT
      </Text>
      <Stack gap="2xs" paddingX="xs">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={usedIds} strategy={verticalListSortingStrategy}>
            {sorts.map((sort, index) => (
              <SortRuleRow
                key={sort.attributeId}
                fields={fields}
                sort={sort}
                usedIds={usedIds}
                onChange={(next) => change(index, next)}
                onRemove={() => remove(index)}
              />
            ))}
          </SortableContext>
        </DndContext>
        {sorts.length === 0 ? (
          <Text textStyle="label/S/regular" color="fg.muted" paddingY="xs">
            No sorts. Rows keep their own order.
          </Text>
        ) : null}
      </Stack>
      <Box borderTopWidth="1px" borderColor="border.subtle" />
      <HStack gap="2xs" paddingX="2xs" paddingBottom="2xs">
        <Button
          size="2xs"
          variant="ghost"
          disabled={!nextField}
          onClick={() => nextField && onChange([...sorts, { attributeId: nextField.id, direction: "asc" }])}
        >
          <Plus />
          Add sort
        </Button>
        <Button size="2xs" variant="ghost" marginLeft="auto" disabled={sorts.length === 0} onClick={() => onChange([])}>
          <Trash2 />
          Delete sort
        </Button>
      </HStack>
    </Stack>
  );
};
