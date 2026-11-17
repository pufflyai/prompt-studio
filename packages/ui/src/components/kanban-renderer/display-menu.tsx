import { Button, HStack, Icon, IconButton, Text } from "@chakra-ui/react";
import { List, Settings2, SquareKanban } from "lucide-react";
import { normalizeSubGroupings } from "pstdio-api-contracts/collections";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { Tooltip } from "@/components/primitives/tooltip";
import { ScopedPopover as Popover } from "@/utils/scoped-overlays";
import { Portal, useUiScope } from "@/utils/ui-scope";
import { DisplayMenuSelect } from "./display-menu-select";
import { type MenuOption, resolveSubGroupingOptions } from "./kanban-renderer-helpers";
import { ResourceListGroupingControls } from "./resource-list-grouping-controls";
import type { KanbanRendererSettings } from "./types";

interface DisplayMenuProps {
  settings: KanbanRendererSettings;
  resourceList?: boolean;
  onShowChildrenChange?: (show: boolean) => void;
  onSubGroupingsChange?: (subGroupings: string[]) => void;
  sortControl?: ReactNode;
  groupingOptions: MenuOption[];
  displayPropertyOptions: MenuOption[];
  onViewModeChange: (value: KanbanRendererSettings["viewMode"]) => void;
  onColumnGroupingChange: (value: string) => void;
  onRowGroupingChange: (value: string) => void;
  onDisplayPropertyToggle: (property: string) => void;
}

export { DisplayMenuSelect, type DisplayMenuSelectProps } from "./display-menu-select";

const SectionLabel = (props: { children: string }) => (
  <Text paddingX="xs" paddingTop="xs" paddingBottom="2xs" textStyle="label/XS/medium" color="fg.muted">
    {props.children}
  </Text>
);

export const DisplayMenu = (props: DisplayMenuProps) => {
  const surfaceActive = useUiScope()?.active ?? true;
  const {
    settings,
    groupingOptions,
    displayPropertyOptions,
    onViewModeChange,
    onColumnGroupingChange,
    onRowGroupingChange,
    onDisplayPropertyToggle,
  } = props;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!surfaceActive || !open) return;
    const closeOnOutsidePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (contentRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePointerDown);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointerDown);
  }, [open, surfaceActive]);

  return (
    <Popover.Root
      open={open}
      closeOnInteractOutside={false}
      positioning={{
        placement: "bottom-end",
        offset: { mainAxis: 8 },
        getAnchorElement: () => triggerRef.current,
      }}
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
          <Popover.Content ref={contentRef} width="18.75rem" padding="xs" gap="1px">
            <SectionLabel>DISPLAY</SectionLabel>
            {props.resourceList ? null : (
              <HStack borderRadius="sm" bg="bg.subtle" padding="2xs" gap="2xs">
                <Button
                  flex="1"
                  size="2xs"
                  variant="ghost"
                  aria-pressed={settings.viewMode === "list"}
                  onClick={() => onViewModeChange("list")}
                >
                  <List />
                  List
                </Button>
                <Button
                  flex="1"
                  size="2xs"
                  variant="ghost"
                  aria-pressed={settings.viewMode === "board"}
                  onClick={() => onViewModeChange("board")}
                >
                  <SquareKanban />
                  Board
                </Button>
              </HStack>
            )}

            <DisplayMenuSelect
              label="Grouping"
              value={settings.columnGrouping}
              options={groupingOptions}
              onSelect={(value) => {
                onColumnGroupingChange(value);
                if (value === "none" || value === settings.rowGrouping) onRowGroupingChange("none");
                // Keep stored levels valid for the new grouping, so saved views never carry stale ones.
                if (props.resourceList)
                  props.onSubGroupingsChange?.(normalizeSubGroupings(value, settings.subGroupings));
              }}
            />
            {props.resourceList ? (
              <>
                <ResourceListGroupingControls
                  settings={settings}
                  groupingOptions={groupingOptions}
                  onSubGroupingsChange={(subGroupings) => props.onSubGroupingsChange?.(subGroupings)}
                />
                <DisplayMenuSelect
                  label="Child rows"
                  value={settings.showChildren === false ? "hide" : "show"}
                  options={[
                    { value: "show", label: "Show" },
                    { value: "hide", label: "Hide" },
                  ]}
                  onSelect={(value) => props.onShowChildrenChange?.(value === "show")}
                />
              </>
            ) : (
              <DisplayMenuSelect
                label="Sub-grouping"
                value={settings.rowGrouping}
                options={resolveSubGroupingOptions(groupingOptions, settings.columnGrouping)}
                onSelect={onRowGroupingChange}
              />
            )}

            {props.sortControl}
            <SectionLabel>PROPERTIES</SectionLabel>
            <HStack paddingX="xs" paddingBottom="xs" flexWrap="wrap" gap="2xs">
              {displayPropertyOptions.map((option) => {
                const active = settings.displayProperties.includes(option.value);
                return (
                  <Button
                    key={option.value}
                    size="2xs"
                    variant="ghost"
                    aria-pressed={active}
                    onClick={() => onDisplayPropertyToggle(option.value)}
                  >
                    {option.label}
                  </Button>
                );
              })}
            </HStack>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
};
