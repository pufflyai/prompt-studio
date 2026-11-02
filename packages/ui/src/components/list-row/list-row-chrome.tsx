import { Icon } from "@chakra-ui/react";
import { type ReactElement, useId } from "react";
import { type ResourceContextAction, ResourceContextMenu } from "@/components/overlays/resource-context-menu";
import { tooltipOpenDelay } from "@/components/primitives/tooltip";
import { ScopedTooltip as ChakraTooltip } from "@/utils/scoped-overlays";
import { Portal } from "@/utils/ui-scope";
import type { ListRowItem } from "./list-row.types";
import { ListRowMenu } from "./list-row-menu";

export const createResourceContextActions = (
  items: NonNullable<ListRowItem["contextMenuItems"]>,
): ResourceContextAction[] =>
  items.map((entry) => ({
    key: entry.id,
    label: entry.label,
    commandId: entry.commandId,
    group: entry.group,
    icon: typeof entry.icon === "function" ? <Icon as={entry.icon} boxSize="16px" /> : entry.icon,
    endContent: entry.endContent,
    isDisabled: entry.disabled,
    separatorBefore: entry.separatorBefore,
    onClick: () => entry.onAction?.(),
  }));

interface ListRowChromeProps {
  item: ListRowItem;
  menuOpen: boolean;
  children: ReactElement;
  onMenuOpenChange: (open: boolean) => void;
  onMenuSelect: (item: NonNullable<ListRowItem["menuItems"]>[number]) => void;
}

export const ListRowChrome = (props: ListRowChromeProps) => {
  const { children, item, menuOpen, onMenuOpenChange, onMenuSelect } = props;
  const generatedTriggerId = useId();

  if (item.menuItems && item.menuItems.length > 0) {
    return (
      <ListRowMenu
        triggerId={item.id}
        items={item.menuItems}
        open={menuOpen}
        placement={item.menuPlacement}
        onOpenChange={onMenuOpenChange}
        onSelect={onMenuSelect}
      >
        {children}
      </ListRowMenu>
    );
  }

  // The context menu clones its direct child, so the tooltip trigger part must be that child: both then attach
  // their handlers to the row. The row keeps its own id when the props merge, so the tooltip finds it by that id.
  const triggerId = (children.props as { id?: string }).id ?? generatedTriggerId;
  const trigger = item.tooltip ? (
    <ChakraTooltip.Trigger asChild id={triggerId}>
      {children}
    </ChakraTooltip.Trigger>
  ) : (
    children
  );
  const row =
    item.contextMenuItems && item.contextMenuItems.length > 0 ? (
      <ResourceContextMenu actions={createResourceContextActions(item.contextMenuItems)}>{trigger}</ResourceContextMenu>
    ) : (
      trigger
    );
  if (!item.tooltip) return row;

  return (
    <ChakraTooltip.Root openDelay={tooltipOpenDelay} closeDelay={100} ids={{ trigger: triggerId }}>
      {row}
      <Portal>
        <ChakraTooltip.Positioner>
          <ChakraTooltip.Content>{item.tooltip}</ChakraTooltip.Content>
        </ChakraTooltip.Positioner>
      </Portal>
    </ChakraTooltip.Root>
  );
};
