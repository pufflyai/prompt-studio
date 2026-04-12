import { IconButton } from "@chakra-ui/react";
import { MenuItem } from "../menu-item";
import { SearchableMenu } from "../searchable-menu";
import type { SidebarAction } from "./sidebar-tree.types";

interface SearchableActionMenuProps {
  action: SidebarAction;
}

export const SearchableActionMenu = (props: SearchableActionMenuProps) => {
  const { action } = props;
  const items = (action.menuItems ?? []).map((item) => ({
    id: item.id,
    label: item.label,
    searchText: [item.label, item.description].filter(Boolean).join(" "),
    tooltipLabel: item.description,
    variant: "compact" as const,
    onSelect: () => item.onAction?.(),
  }));

  return (
    <SearchableMenu
      trigger={
        <IconButton variant="ghost" size="2xs" aria-label={action.label}>
          {action.icon}
        </IconButton>
      }
      items={items}
      searchPlaceholder={action.searchPlaceholder ?? "Search…"}
      emptyState={<MenuItem primaryLabel={action.emptyMenuLabel ?? "No results found"} isDisabled variant="compact" />}
      onFocusOutside={(event) => event.preventDefault()}
    />
  );
};
