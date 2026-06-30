import { Icon } from "@chakra-ui/react";
import type { ReactElement } from "react";
import { type ResourceContextAction, ResourceContextMenu } from "@/components/overlays/resource-context-menu";
import { Tooltip } from "@/components/primitives/tooltip";
import type { ListRowItem } from "./list-row.types";
import { ListRowMenu } from "./list-row-menu";

const createResourceContextActions = (items: NonNullable<ListRowItem["contextMenuItems"]>): ResourceContextAction[] =>
  items.map((entry) => ({
    key: entry.id,
    label: entry.label,
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

  if (item.menuItems && item.menuItems.length > 0) {
    return (
      <ListRowMenu
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

  const row = item.tooltip ? <Tooltip content={item.tooltip}>{children}</Tooltip> : children;
  if (!item.contextMenuItems || item.contextMenuItems.length === 0) return row;

  return (
    <ResourceContextMenu actions={createResourceContextActions(item.contextMenuItems)} contentMinWidth="180px">
      {row}
    </ResourceContextMenu>
  );
};
