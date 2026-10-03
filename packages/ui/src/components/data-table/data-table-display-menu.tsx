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
import { Tooltip } from "@/components/primitives/tooltip";
import { fieldIcon } from "../collection-view/collection-view-field-icon";
import { DisplayMenuSelect } from "../kanban-renderer/display-menu";
import type { AttributeDescriptor } from "../kanban-renderer/types";
import type { DataTableSettings } from "./types";

export interface DataTableDisplayMenuProps {
  /** Every column in display order, hidden ones included. */
  columns: AttributeDescriptor[];
  settings: DataTableSettings;
  statsAvailable: boolean;
  onSettingsChange: (settings: Partial<DataTableSettings>) => void;
  onColumnVisibilityChange: (columnId: string, visible: boolean) => void;
  onColumnReorder: (activeColumnId: string, overColumnId: string) => void;
}

const SectionLabel = (props: { children: string; end?: string }) => (
  <HStack paddingX="xs" paddingTop="xs" paddingBottom="2xs">
    <Text textStyle="label/XS/medium" color="fg.muted">
      {props.children}
    </Text>
    {props.end ? (
      <Text marginLeft="auto" textStyle="label/XS" color="fg.subtle">
        {props.end}
      </Text>
    ) : null}
  </HStack>
);

interface SettingSwitchProps {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

const SettingSwitch = (props: SettingSwitchProps) => (
  <Box paddingX="xs" paddingY="2xs">
    <Switch
      checked={props.checked}
      inputProps={{ role: "switch" }}
      width="full"
      flexDirection="row-reverse"
      justifyContent="space-between"
      onCheckedChange={(details) => props.onChange(details.checked === true)}
    >
      <HStack as="span" gap="xs">
        <Text as="span" textStyle="label/S/regular">
          {props.label}
        </Text>
        {props.hint ? (
          <Text as="span" textStyle="label/XS" color="fg.subtle">
            {props.hint}
          </Text>
        ) : null}
      </HStack>
    </Switch>
  </Box>
);

interface ColumnRowProps {
  column: AttributeDescriptor;
  checked: boolean;
  onColumnVisibilityChange: (columnId: string, visible: boolean) => void;
}

const ColumnRow = (props: ColumnRowProps) => {
  const { column, checked, onColumnVisibilityChange } = props;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: column.id });

  return (
    <HStack
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
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
        size="sm"
        icon={<Icon as={Check} boxSize="12px" strokeWidth="3" />}
        onCheckedChange={(details) => onColumnVisibilityChange(column.id, details.checked === true)}
      >
        <Text as="span" textStyle="label/S/regular" truncate>
          {column.label}
        </Text>
      </Checkbox>
      <Icon as={fieldIcon(column)} boxSize="0.75rem" color="fg.subtle" flexShrink={0} />
    </HStack>
  );
};

/** Table display: every setting here is saved with the view. Column width stays local. */
export const DataTableDisplayMenu = (props: DataTableDisplayMenuProps) => {
  const { columns, settings, statsAvailable, onSettingsChange, onColumnVisibilityChange, onColumnReorder } = props;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const needle = query.trim().toLowerCase();
  const filteredColumns = needle ? columns.filter((column) => column.label.toLowerCase().includes(needle)) : columns;
  const shownCount = columns.filter((column) => !settings.hiddenColumns.includes(column.id)).length;
  const groupingOptions = [
    { value: "none", label: "None" },
    ...columns.filter((column) => column.groupable).map((column) => ({ value: column.id, label: column.label })),
  ];

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) onColumnReorder(String(active.id), String(over.id));
  };

  useEffect(() => {
    if (!open) return;
    // Menus inside the popover render in place, so a click outside both the trigger and the content closes it.
    const closeOnOutsidePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (contentRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePointerDown);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointerDown);
  }, [open]);

  return (
    <Popover.Root
      open={open}
      closeOnInteractOutside={false}
      positioning={{ placement: "bottom-end", offset: { mainAxis: 8 }, getAnchorElement: () => triggerRef.current }}
      onOpenChange={(details) => setOpen(details.open)}
    >
      <Tooltip content="Display">
        <Popover.Trigger asChild>
          <IconButton ref={triggerRef} aria-label="Display settings" variant="ghost" size="2xs">
            <Icon as={Settings2} />
          </IconButton>
        </Popover.Trigger>
      </Tooltip>
      <Portal>
        <Popover.Positioner>
          <Popover.Content
            ref={contentRef}
            data-testid="data-table-display-menu"
            width="min(300px, calc(100vw - 32px))"
            padding="2xs"
            gap="1px"
          >
            <SectionLabel>TABLE DISPLAY</SectionLabel>
            {groupingOptions.length > 1 ? (
              <DisplayMenuSelect
                label="Grouping"
                value={settings.grouping}
                options={groupingOptions}
                onSelect={(grouping) => onSettingsChange({ grouping })}
              />
            ) : null}
            <SettingSwitch
              label="Row numbers"
              checked={settings.rowNumbers}
              onChange={(rowNumbers) => onSettingsChange({ rowNumbers })}
            />
            <SettingSwitch
              label="Wrap rows"
              checked={settings.wrapRows}
              onChange={(wrapRows) => onSettingsChange({ wrapRows })}
            />
            {statsAvailable ? (
              <SettingSwitch
                label="Statistics"
                hint="from column stats"
                checked={settings.showStats}
                onChange={(showStats) => onSettingsChange({ showStats })}
              />
            ) : null}
            <Box borderTopWidth="1px" borderColor="border.subtle" marginY="2xs" />
            <SectionLabel end={`${shownCount} of ${columns.length} shown`}>COLUMNS</SectionLabel>
            <SearchableMenuInput value={query} placeholder="Search columns" onValueChange={setQuery} />
            <ScrollArea maxH="280px" viewportProps={{ overscrollBehavior: "contain" }}>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={columns.map((column) => column.id)} strategy={verticalListSortingStrategy}>
                  <Stack gap="1px" padding="2xs">
                    {filteredColumns.map((column) => (
                      <ColumnRow
                        key={column.id}
                        column={column}
                        checked={!settings.hiddenColumns.includes(column.id)}
                        onColumnVisibilityChange={onColumnVisibilityChange}
                      />
                    ))}
                  </Stack>
                </SortableContext>
              </DndContext>
            </ScrollArea>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
};
