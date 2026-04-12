import { Input, InputGroup, Menu, Portal } from "@chakra-ui/react";
import { ChevronDown, Search } from "lucide-react";
import { type ElementType, Fragment, type ReactNode, useEffect, useRef, useState } from "react";
import { MenuItem } from "./menu-item";
import { ScrollArea } from "./scroll-area";

type MenuRootProps = React.ComponentProps<typeof Menu.Root>;
type MenuContentProps = React.ComponentProps<typeof Menu.Content>;

export interface SearchableMenuItem {
  id: string;
  label: string;
  searchText?: string;
  secondaryLabel?: string;
  tooltipLabel?: ReactNode;
  icon?: ElementType;
  variant?: "default" | "compact";
  isDisabled?: boolean;
  isSelected?: boolean;
  onSelect?: () => void;
}

export interface SearchableMenuParentList<T extends SearchableMenuItem> {
  items: T[];
  selectedLabel: string;
  selectedIcon?: ElementType;
  ariaLabel?: string;
  disabled?: boolean;
  emptyState?: ReactNode;
  filterItems?: (items: T[], query: string) => T[];
  searchPlaceholder?: string;
  showSearch?: boolean;
  contentTestId?: string;
  onSelect?: (item: T) => void;
}

interface ListConfig<T extends SearchableMenuItem> {
  items: T[];
  filterItems: (items: T[], query: string) => T[];
  showSearch: boolean;
  searchPlaceholder: string;
  emptyState: ReactNode;
  contentTestId?: string;
  closeOnSelect: boolean;
  listId: string;
}

interface SearchableMenuProps<T extends SearchableMenuItem> {
  trigger: ReactNode;
  items: T[];
  searchPlaceholder: string;
  emptyState: ReactNode;
  filterItems?: (items: T[], query: string) => T[];
  listId?: string;
  header?: ReactNode;
  width?: MenuContentProps["width"];
  maxListHeight?: string;
  showSearch?: boolean;
  closeOnSelect?: MenuRootProps["closeOnSelect"];
  lazyMount?: MenuRootProps["lazyMount"];
  open?: MenuRootProps["open"];
  positioning?: MenuRootProps["positioning"];
  onOpenChange?: MenuRootProps["onOpenChange"];
  onFocusOutside?: MenuRootProps["onFocusOutside"];
  contentTestId?: string;
  portalled?: boolean;
  parentList?: SearchableMenuParentList<T>;
}

export const filterSearchableMenuItems = <T extends SearchableMenuItem>(items: T[], query: string) => {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return items;
  }

  return items.filter((item) => {
    const content = [item.label, item.searchText].filter(Boolean).join(" ").toLowerCase();
    return content.includes(normalizedQuery);
  });
};

export const shouldResetSearchableMenuQuery = (currentListId?: string, nextListId?: string) => {
  if (!currentListId || !nextListId) {
    return false;
  }

  return currentListId !== nextListId;
};

export const resolveActiveListConfig = <T extends SearchableMenuItem>(
  isShowingParent: boolean,
  parentList: SearchableMenuParentList<T> | undefined,
  childConfig: ListConfig<T>,
): ListConfig<T> => {
  if (!isShowingParent || !parentList) {
    return childConfig;
  }

  return {
    items: parentList.items,
    filterItems: parentList.filterItems ?? childConfig.filterItems,
    showSearch: parentList.showSearch ?? childConfig.showSearch,
    searchPlaceholder: parentList.searchPlaceholder ?? childConfig.searchPlaceholder,
    emptyState: parentList.emptyState ?? childConfig.emptyState,
    contentTestId: parentList.contentTestId ?? childConfig.contentTestId,
    closeOnSelect: false,
    listId: "parent",
  };
};

const searchInputBorderProps = {
  borderColor: "border.muted",
  boxShadow: "none",
  outline: "none",
} as const;

export const SearchableMenu = <T extends SearchableMenuItem>(props: SearchableMenuProps<T>) => {
  const {
    trigger,
    items,
    searchPlaceholder,
    emptyState,
    filterItems = filterSearchableMenuItems,
    listId,
    header,
    width = "260px",
    maxListHeight = "18rem",
    showSearch = true,
    closeOnSelect = true,
    lazyMount = false,
    open,
    positioning,
    onOpenChange,
    onFocusOutside,
    contentTestId,
    portalled = true,
    parentList,
  } = props;
  const hasParentList = Boolean(parentList);
  const [internalOpen, setInternalOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeList, setActiveList] = useState<"child" | "parent">("child");
  const inputRef = useRef<HTMLInputElement>(null);
  const isOpen = open ?? internalOpen;
  const isShowingParent = hasParentList && activeList === "parent";

  const childConfig: ListConfig<T> = {
    items,
    filterItems,
    showSearch,
    searchPlaceholder,
    emptyState,
    contentTestId,
    closeOnSelect,
    listId: hasParentList ? "child" : (listId ?? ""),
  };

  const config = resolveActiveListConfig(isShowingParent, parentList, childConfig);
  const filteredItems = config.filterItems(config.items, query);
  const previousListIdRef = useRef(config.listId);

  useEffect(() => {
    if (!isOpen) {
      previousListIdRef.current = config.listId;
      return;
    }

    if (shouldResetSearchableMenuQuery(previousListIdRef.current, config.listId)) {
      setQuery("");
    }

    previousListIdRef.current = config.listId;
  }, [isOpen, config.listId]);

  useEffect(() => {
    if (!isOpen || !config.showSearch) {
      return;
    }

    const timeout = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(timeout);
  }, [isOpen, config.showSearch]);

  const handleOpenChange: NonNullable<MenuRootProps["onOpenChange"]> = (details) => {
    if (open === undefined) {
      setInternalOpen(details.open);
    }

    setQuery("");

    if (details.open && hasParentList) {
      setActiveList("child");
    }

    onOpenChange?.(details);
  };

  const handleMenuItemSelect = (details: { value: string }) => {
    if (!isShowingParent || !parentList) return;

    const item = parentList.items.find((i) => i.id === details.value);
    if (!item) return;

    parentList.onSelect?.(item);
    setActiveList("child");
  };

  const parentListHeader = parentList ? (
    <div
      onPointerDownCapture={(event) => event.stopPropagation()}
      onClickCapture={(event) => {
        event.stopPropagation();
        if (parentList.disabled) return;
        setActiveList((current) => (current === "child" ? "parent" : "child"));
      }}
    >
      <MenuItem
        primaryLabel={parentList.selectedLabel}
        leftIcon={parentList.selectedIcon}
        rightIcon={parentList.disabled ? undefined : ChevronDown}
        isDisabled={parentList.disabled}
      />
    </div>
  ) : null;

  const resolvedHeader = parentList ? parentListHeader : header;
  const shouldShowSeparator = Boolean(resolvedHeader) && !config.showSearch;

  const searchInput = config.showSearch ? (
    <InputGroup startElement={<Search size={14} />}>
      <Input
        ref={inputRef}
        borderRight={0}
        borderLeft={0}
        borderRadius="0"
        borderColor="border.muted"
        value={query}
        placeholder={config.searchPlaceholder}
        aria-label={config.searchPlaceholder}
        autoComplete="off"
        _hover={searchInputBorderProps}
        _active={searchInputBorderProps}
        _focus={searchInputBorderProps}
        _focusVisible={searchInputBorderProps}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => event.stopPropagation()}
      />
    </InputGroup>
  ) : null;

  return (
    <Menu.Root
      lazyMount={lazyMount}
      closeOnSelect={config.closeOnSelect}
      open={open}
      positioning={positioning}
      onOpenChange={handleOpenChange}
      onFocusOutside={onFocusOutside}
      onSelect={hasParentList ? handleMenuItemSelect : undefined}
    >
      <Menu.Trigger asChild>{trigger}</Menu.Trigger>
      <Portal disabled={!portalled}>
        <Menu.Positioner>
          <Menu.Content w={width} bg="bg" gap="0" p="0" zIndex="popover">
            {resolvedHeader}
            {searchInput}
            {shouldShowSeparator ? <Menu.Separator margin="0" /> : null}
            <ScrollArea
              maxH={maxListHeight}
              data-testid={config.contentTestId}
              viewportProps={{ overscrollBehavior: "contain" }}
              p="2xs"
              gap="2xs"
            >
              {filteredItems.length > 0
                ? filteredItems.map((item) => (
                    <Fragment key={item.id}>
                      <MenuItem
                        id={item.id}
                        primaryLabel={item.label}
                        secondaryLabel={item.secondaryLabel}
                        tooltipLabel={item.tooltipLabel}
                        leftIcon={item.icon}
                        variant={item.variant}
                        isDisabled={item.isDisabled}
                        isSelected={item.isSelected}
                        onClick={item.onSelect}
                      />
                    </Fragment>
                  ))
                : config.emptyState}
            </ScrollArea>
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
};
