import { IconButton, Menu } from "@chakra-ui/react";
import { SearchableMenu } from "@/components/overlays/searchable-menu";
import { ListRow } from "./list-row";
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
    variant: "full-width" as const,
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
        <Menu.Item value="empty" asChild>
          <ListRow asChild variant="full-width" label={action.emptyMenuLabel ?? "No results found"} disabled />
        </Menu.Item>
      }
      onFocusOutside={(event) => event.preventDefault()}
    />
  );
};
