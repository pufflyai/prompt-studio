import { IconButton } from "@chakra-ui/react";
import { MenuItem } from "../menu-item";
import { SearchableMenu } from "../searchable-menu";
import type { ListRowAction } from "./list-row.types";

interface SearchableActionMenuProps {
  action: ListRowAction;
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
      searchPlaceholder={action.searchPlaceholder ?? "Search..."}
      emptyState={
        <MenuItem
          variant="compact"
          item={{ id: "empty", label: action.emptyMenuLabel ?? "No results found", disabled: true }}
        />
      }
      onFocusOutside={(event) => event.preventDefault()}
    />
  );
};
