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
    ...item,
    searchText: [item.label, item.description].filter(Boolean).join(" "),
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
      renderItem={(item) => (
        <MenuItem
          id={item.id}
          primaryLabel={item.label}
          tooltipLabel={item.description}
          variant="compact"
          onClick={() => item.onAction?.()}
        />
      )}
      onFocusOutside={(event) => event.preventDefault()}
    />
  );
};
