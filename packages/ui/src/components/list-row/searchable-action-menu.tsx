import { SearchableMenu } from "@/components/overlays/searchable-menu";
import { ScopedMenu as Menu } from "@/utils/scoped-overlays";
import { ActionIconButton } from "./action-icon-button";
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
    isDisabled: item.disabled || item.readOnly,
    onSelect: () => item.onAction?.(),
  }));

  return (
    <SearchableMenu
      trigger={
        <ActionIconButton
          tooltip={action.tooltip ?? action.label}
          variant="ghost"
          size="2xs"
          aria-label={action.label}
          disabled={action.disabled}
        >
          {action.icon}
        </ActionIconButton>
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
