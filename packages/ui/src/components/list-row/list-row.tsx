import { Box, chakra, HStack, Icon, Stack, Text } from "@chakra-ui/react";
import { ChevronRight } from "lucide-react";
import { forwardRef, type ReactElement, type MouseEvent as ReactMouseEvent } from "react";
import { ResourceContextMenu } from "../resource-context-menu";
import { Tooltip } from "../tooltip";
import type { ListRowItem, ListRowProps, ListRowVariant, RowContentProps } from "./list-row.types";
import { RowActions } from "./list-row-actions";

const RowContent = (props: RowContentProps) => {
  const { item, isExpanded, showChevron, isDisabled, variant, tone } = props;
  const labelTextStyle = variant === "compact" ? "label/S/regular" : "label/M/regular";
  const descriptionTextStyle = variant === "compact" ? "label/XS" : "label/S/regular";
  const descriptionMarginLeft = variant === "compact" ? "0" : "2px";

  const labelColor = (() => {
    if (isDisabled) return "fg.muted";
    if (tone === "danger") return "red.500";
    return "fg";
  })();
  const iconColor = item.iconColor ?? (tone === "danger" ? "red.500" : "fg.muted");
  const descriptionColor = tone === "danger" ? "red.400" : "fg.menu-item.secondary";

  return (
    <HStack gap="2" minW="0" flex="1" overflow="hidden" alignItems="center">
      {showChevron ? (
        <Box color="fg.muted" flexShrink={0} display="flex" alignItems="center">
          <ChevronRight
            size={12}
            style={{ transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)", transition: "120ms" }}
          />
        </Box>
      ) : null}
      <Stack gap="2xs" minW="0" flex="1">
        <HStack gap="2" minW="0" alignItems="center">
          {item.icon ? (
            <Box color={iconColor} flexShrink={0}>
              {item.icon}
            </Box>
          ) : null}
          {item.indicator ? (
            <Tooltip content={item.indicator.tooltip} disabled={!item.indicator.tooltip} openDelay={300}>
              <Box color={item.indicator.color ?? "fg.muted"} flexShrink={0}>
                {item.indicator.icon}
              </Box>
            </Tooltip>
          ) : null}
          {typeof item.label === "string" ? (
            <Text textStyle={labelTextStyle} color={labelColor} truncate>
              {item.label}
            </Text>
          ) : (
            <Box minW="0" maxW="full" overflow="hidden">
              {item.label}
            </Box>
          )}
        </HStack>
        {item.description ? (
          typeof item.description === "string" ? (
            <Text ml={descriptionMarginLeft} textStyle={descriptionTextStyle} color={descriptionColor} truncate>
              {item.description}
            </Text>
          ) : (
            <Box ml={descriptionMarginLeft} minW="0" maxW="full" overflow="hidden">
              {item.description}
            </Box>
          )
        ) : null}
      </Stack>
    </HStack>
  );
};

const computePaddingLeft = (depth: number, variant: ListRowVariant) => {
  if (depth <= 0) return undefined;
  const indent = variant === "tree" ? 12 : 12;
  return `calc(var(--chakra-spacing-1) + ${depth} * ${indent}px)`;
};

export const ListRow = forwardRef<HTMLElement, ListRowProps>((props, ref) => {
  const {
    id,
    label,
    description,
    icon,
    iconColor,
    indicator,
    endContent,
    tooltip,
    disabled,
    isContainer,
    isNavigable,
    href,
    navigationIntent,
    contextMenuItems,
    actions,
    children,
    onActivate,
    depth = 0,
    isSelected = false,
    isExpanded = false,
    showExpandToggle = false,
    variant = "default",
    tone = "default",
    asChild = false,
    className,
    onToggleExpand,
    onPointerMove,
    draggable,
    onDragStart,
    onDragOver,
    onDragEnd,
    onDrop,
    onClick,
    ...rootProps
  } = props;

  const item: ListRowItem = {
    id,
    label,
    description,
    icon,
    iconColor,
    indicator,
    endContent,
    tooltip,
    disabled,
    isContainer,
    isNavigable,
    href,
    navigationIntent,
    contextMenuItems,
    actions,
    children,
    onActivate,
  };

  const dragProps = { draggable, onDragStart, onDragOver, onDragEnd, onDrop };

  const hasChildren = (item.children?.length ?? 0) > 0 || item.isContainer === true;
  const showChevron = showExpandToggle && hasChildren;
  const isDisabled = item.disabled === true;

  const handleActivate = () => {
    if (isDisabled) return;
    if (showChevron) {
      onToggleExpand?.();
      return;
    }
    if (onActivate) {
      onActivate();
      return;
    }
    item.onActivate?.();
  };

  const handleClick = (event: ReactMouseEvent<HTMLElement>) => {
    onClick?.(event);
    if (event.defaultPrevented) return;

    if (isDisabled) {
      event.preventDefault();
      return;
    }
    handleActivate();
  };

  const paddingLeft = computePaddingLeft(depth, variant);
  const verticalPadding = variant === "default" ? "xs" : "2xs";
  const minHeight = variant === "default" ? "2.25rem" : "1.75rem";

  const rowProps = {
    ...rootProps,
    role: "option" as const,
    "aria-selected": isSelected,
    className: className ? `group ${className}` : "group",
    width: "full",
    minWidth: "0",
    maxWidth: "full",
    height: "auto" as const,
    minHeight,
    display: "flex" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    gap: "xs" as const,
    px: "sm",
    py: verticalPadding,
    pl: paddingLeft,
    borderRadius: "0" as const,
    bg: isSelected ? "bg.menu-item.selected" : "transparent",
    _hover:
      tone === "danger" ? { boxShadow: "inset 0 0 0 1px var(--chakra-colors-red-500)" } : { bg: "bg.menu-item.hover" },
    cursor: isDisabled ? ("not-allowed" as const) : ("pointer" as const),
    overflow: "hidden" as const,
    textAlign: "left" as const,
    color: "inherit",
    textDecoration: "none",
  };

  const content = (
    <>
      <RowContent
        item={item}
        isExpanded={isExpanded}
        showChevron={showChevron}
        isDisabled={isDisabled}
        tone={tone}
        variant={variant}
      />
      {item.endContent ? (
        <Box flexShrink={0} color="fg.muted" display="flex" alignItems="center">
          {item.endContent}
        </Box>
      ) : null}
      {item.actions && item.actions.length > 0 ? (
        <RowActions actions={item.actions} context={{ nodeId: item.id }} />
      ) : null}
    </>
  );

  const wrapWithContextMenu = (children: ReactElement) => {
    if (!item.contextMenuItems || item.contextMenuItems.length === 0) return children;

    const contextActions = item.contextMenuItems.map((entry) => ({
      key: entry.id,
      label: entry.label,
      icon: typeof entry.icon === "function" ? <Icon as={entry.icon} boxSize="16px" /> : entry.icon,
      isDisabled: entry.disabled,
      onClick: () => entry.onAction?.(),
    }));

    return (
      <ResourceContextMenu actions={contextActions} contentMinWidth="180px">
        {children}
      </ResourceContextMenu>
    );
  };

  const wrapWithTooltip = (children: ReactElement) => {
    if (!item.tooltip) return children;
    return <Tooltip content={item.tooltip}>{children}</Tooltip>;
  };

  const wrap = (children: ReactElement) => wrapWithContextMenu(wrapWithTooltip(children));

  if (asChild) {
    return wrap(
      <chakra.div ref={ref} {...rowProps} {...dragProps} onClick={handleClick} onPointerMove={onPointerMove}>
        {content}
      </chakra.div>,
    );
  }

  if (item.href && !showChevron && !isDisabled) {
    return wrap(
      <chakra.a
        ref={ref}
        href={item.href}
        {...(rowProps as object)}
        {...dragProps}
        onClick={handleClick}
        onPointerMove={onPointerMove}
      >
        {content}
      </chakra.a>,
    );
  }

  return wrap(
    <chakra.button
      ref={ref}
      type="button"
      disabled={isDisabled}
      {...(rowProps as object)}
      {...dragProps}
      onClick={handleClick}
      onPointerMove={onPointerMove}
    >
      {content}
    </chakra.button>,
  );
});
