import { Input, InputGroup, Menu, Portal } from "@chakra-ui/react";
import { Search } from "lucide-react";
import { Fragment, type ReactNode, useEffect, useRef, useState } from "react";
import { ScrollArea } from "./scroll-area";

type MenuRootProps = React.ComponentProps<typeof Menu.Root>;
type MenuContentProps = React.ComponentProps<typeof Menu.Content>;

export interface SearchableMenuItem {
  id: string;
  label: string;
  searchText?: string;
}

interface SearchableMenuProps<T extends SearchableMenuItem> {
  trigger: ReactNode;
  items: T[];
  searchPlaceholder: string;
  emptyState: ReactNode;
  renderItem: (item: T) => ReactNode;
  filterItems?: (items: T[], query: string) => T[];
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

export const SearchableMenu = <T extends SearchableMenuItem>(props: SearchableMenuProps<T>) => {
  const {
    trigger,
    items,
    searchPlaceholder,
    emptyState,
    renderItem,
    filterItems = filterSearchableMenuItems,
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
  } = props;
  const [internalOpen, setInternalOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const isOpen = open ?? internalOpen;
  const filteredItems = filterItems(items, query);

  useEffect(() => {
    if (!isOpen || !showSearch) {
      return;
    }

    const timeout = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(timeout);
  }, [isOpen, showSearch]);

  const handleOpenChange: NonNullable<MenuRootProps["onOpenChange"]> = (details) => {
    if (open === undefined) {
      setInternalOpen(details.open);
    }

    setQuery("");
    onOpenChange?.(details);
  };

  const shouldShowSeparator = Boolean(header && !showSearch);

  return (
    <Menu.Root
      lazyMount={lazyMount}
      closeOnSelect={closeOnSelect}
      open={open}
      positioning={positioning}
      onOpenChange={handleOpenChange}
      onFocusOutside={onFocusOutside}
    >
      <Menu.Trigger asChild>{trigger}</Menu.Trigger>
      <Portal disabled={!portalled}>
        <Menu.Positioner>
          <Menu.Content w={width} bg="bg" p="0" zIndex="popover">
            {header}
            {showSearch ? (
              <InputGroup startElement={<Search size={14} />}>
                <Input
                  ref={inputRef}
                  borderRight={0}
                  borderLeft={0}
                  borderRadius="0"
                  value={query}
                  placeholder={searchPlaceholder}
                  aria-label={searchPlaceholder}
                  autoComplete="off"
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => event.stopPropagation()}
                />
              </InputGroup>
            ) : null}
            {shouldShowSeparator ? <Menu.Separator margin="0" /> : null}
            <ScrollArea
              maxH={maxListHeight}
              data-testid={contentTestId}
              viewportProps={{ overscrollBehavior: "contain" }}
            >
              {filteredItems.length > 0
                ? filteredItems.map((item) => <Fragment key={item.id}>{renderItem(item)}</Fragment>)
                : emptyState}
            </ScrollArea>
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
};
