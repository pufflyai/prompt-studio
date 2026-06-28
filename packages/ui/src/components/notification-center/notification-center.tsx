import { Badge, Box, Button, HStack, Icon, Skeleton, Stack, Text } from "@chakra-ui/react";
import { Bell, Search, X } from "lucide-react";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { AlertMessage } from "../alert";
import { ListRow } from "../list-row/list-row";
import type { ListRowAction } from "../list-row/list-row.types";
import { SearchModalContent } from "../search-modal-content";
import type {
  NotificationCenterAction,
  NotificationCenterItem,
  NotificationCenterProps,
} from "./notification-center.types";

const ACTIVE_ROW_BG = "bg.menu-item.hover";

const priorityColorPalette = (priority: NotificationCenterItem["priority"]) => {
  if (priority === "urgent") return "red";
  if (priority === "high") return "orange";
  if (priority === "low") return "gray";
  return "blue";
};

const shouldShowPriorityBadge = (priority: NotificationCenterItem["priority"]) => priority !== "normal";

const itemSearchText = (item: NotificationCenterItem) =>
  [
    item.title,
    item.body,
    item.kind,
    item.priority,
    item.status,
    item.sourceLabel,
    item.targetLabel,
    item.searchText,
    ...(item.actions ?? []).map((action) => action.label),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

const filterItems = (items: NotificationCenterItem[], query: string) => {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return items;
  return items.filter((item) => itemSearchText(item).includes(normalizedQuery));
};

const groupItems = (items: NotificationCenterItem[]) => {
  const needsInput = items.filter((item) => item.kind === "blocked");
  const urgent = items.filter(
    (item) => item.kind !== "blocked" && (item.priority === "urgent" || item.priority === "high"),
  );
  const normal = items.filter(
    (item) => item.kind !== "blocked" && (item.priority === "normal" || item.priority === "low"),
  );
  return [
    { id: "needs-input", label: "Needs input", items: needsInput },
    { id: "attention", label: "Needs attention", items: urgent },
    { id: "other", label: "Other", items: normal },
  ].filter((group) => group.items.length > 0);
};

const orderItemsForDisplay = (items: NotificationCenterItem[]) => groupItems(items).flatMap((group) => group.items);

const metadataDescription = (item: NotificationCenterItem) => {
  const parts = [item.body, item.targetLabel, item.sourceLabel, item.timeLabel].filter(Boolean);
  return parts.join(" · ");
};

const getActionButtons = (item: NotificationCenterItem, props: Pick<NotificationCenterProps, "onDismiss">) => {
  const actions: ListRowAction[] = [];

  if (props.onDismiss) {
    actions.push({
      id: "dismiss",
      label: "Dismiss",
      icon: <X size={14} />,
      tooltip: "Dismiss",
      onAction: () => props.onDismiss?.(item),
    });
  }

  return actions;
};

const NotificationEndContent = (props: {
  actions: NotificationCenterAction[];
  item: NotificationCenterItem;
  onRunAction?: NotificationCenterProps["onRunAction"];
}) => {
  const { actions, item, onRunAction } = props;
  return (
    <HStack gap="2" minW="0" flexWrap="wrap" justify="flex-end">
      {shouldShowPriorityBadge(item.priority) ? (
        <Badge size="sm" colorPalette={priorityColorPalette(item.priority)} textTransform="capitalize" flexShrink={0}>
          {item.priority}
        </Badge>
      ) : null}
      {item.status === "open" ? (
        <Badge size="sm" colorPalette="blue" variant="solid" flexShrink={0}>
          New
        </Badge>
      ) : null}
      {actions.map((action) => (
        <Button
          key={action.id}
          size="2xs"
          variant="outline"
          colorPalette={action.destructive ? "red" : "gray"}
          maxW="9rem"
          onClick={(event) => {
            event.stopPropagation();
            onRunAction?.(item, action);
          }}
        >
          <Text truncate>{action.label}</Text>
        </Button>
      ))}
    </HStack>
  );
};

const NotificationRows = (
  props: {
    activeIndex: number;
    items: NotificationCenterItem[];
    onActiveIndexChange: (index: number) => void;
  } & Pick<NotificationCenterProps, "onActivateItem" | "onDismiss" | "onRunAction">,
) => {
  const { activeIndex, items, onActivateItem, onActiveIndexChange, onRunAction } = props;
  const groups = groupItems(items);
  let rowIndex = 0;

  return (
    <Stack gap="2xs" py="xs">
      {groups.map((group) => (
        <Stack key={group.id} gap="2xs">
          <Text textStyle="label/XS/medium" color="fg.muted" px="sm" pt="xs">
            {group.label}
          </Text>
          {group.items.map((item) => {
            const currentIndex = rowIndex;
            rowIndex += 1;
            return (
              <ListRow
                key={item.id}
                id={item.id}
                label={item.title}
                description={metadataDescription(item)}
                icon={<Icon as={Bell} boxSize="14px" />}
                iconColor={`${priorityColorPalette(item.priority)}.500`}
                variant="compact"
                isSelected={currentIndex === activeIndex}
                selectedBg={ACTIVE_ROW_BG}
                hoverBg={ACTIVE_ROW_BG}
                endContent={
                  <NotificationEndContent item={item} actions={item.actions ?? []} onRunAction={onRunAction} />
                }
                actions={getActionButtons(item, props)}
                tabIndex={-1}
                onActivate={() => onActivateItem?.(item)}
                onPointerMove={() => onActiveIndexChange(currentIndex)}
              />
            );
          })}
        </Stack>
      ))}
    </Stack>
  );
};

const LoadingRows = () => (
  <Stack gap="2" p="sm">
    {[0, 1, 2, 3].map((row) => (
      <Stack key={row} gap="2xs">
        <Skeleton h="4" w={row % 2 === 0 ? "68%" : "52%"} borderRadius="xs" />
        <Skeleton h="3" w="88%" borderRadius="xs" />
      </Stack>
    ))}
  </Stack>
);

export const NotificationCenter = (props: NotificationCenterProps) => {
  const {
    autoFocus = false,
    emptyLabel = "No notifications.",
    error,
    footerEnd,
    footerStart,
    items,
    loading = false,
    onActivateItem,
    onEscape,
    onQueryChange,
    query,
  } = props;
  const [internalQuery, setInternalQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const activeQuery = query ?? internalQuery;
  const filteredItems = filterItems(items, activeQuery);
  const displayItems = orderItemsForDisplay(filteredItems);
  const activeItem = displayItems[activeIndex] ?? null;

  useEffect(() => {
    if (!autoFocus) return;
    const timeout = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(timeout);
  }, [autoFocus]);

  useEffect(() => {
    setActiveIndex((current) => Math.min(current, Math.max(displayItems.length - 1, 0)));
  }, [displayItems.length]);

  const updateQuery = (nextQuery: string) => {
    if (query === undefined) setInternalQuery(nextQuery);
    onQueryChange?.(nextQuery);
    setActiveIndex(0);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => Math.min(current + 1, Math.max(displayItems.length - 1, 0)));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      if (activeItem) onActivateItem?.(activeItem);
      return;
    }
    if (event.key !== "Escape") return;
    event.preventDefault();
    if (activeQuery.length > 0) {
      updateQuery("");
      return;
    }
    onEscape?.();
  };

  return (
    <SearchModalContent
      searchValue={activeQuery}
      searchPlaceholder="Search notifications"
      searchIcon={<Search size={14} />}
      searchInputRef={inputRef}
      searchAutoFocus={autoFocus}
      footerStart={footerStart}
      footerEnd={footerEnd}
      scrollAreaProps={{ maxH: "24rem", showHorizontalScrollbar: false }}
      onSearchChange={updateQuery}
      onSearchKeyDown={handleKeyDown}
    >
      {error ? (
        <Box p="sm">
          <AlertMessage status="error" colorPalette="red" title="Notifications unavailable" size="sm">
            {error}
          </AlertMessage>
        </Box>
      ) : loading ? (
        <LoadingRows />
      ) : filteredItems.length === 0 ? (
        <Text textStyle="paragraph/S/regular" color="fg.muted" px="sm" py="md">
          {emptyLabel}
        </Text>
      ) : (
        <NotificationRows
          {...props}
          items={filteredItems}
          activeIndex={activeIndex}
          onActiveIndexChange={setActiveIndex}
        />
      )}
    </SearchModalContent>
  );
};
