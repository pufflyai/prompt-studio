import { chakra, Icon } from "@chakra-ui/react";
import { forwardRef, type ReactElement, type MouseEvent as ReactMouseEvent, useState } from "react";
import { ResourceContextMenu } from "../resource-context-menu";
import { Tooltip } from "../tooltip";
import type { ListRowItem, ListRowProps } from "./list-row.types";
import { ListRowContent } from "./list-row-content";
import { ListRowMenu } from "./list-row-menu";

const computePaddingLeft = (depth: number) => {
  if (depth <= 0) return undefined;
  return `calc(var(--chakra-spacing-1) + ${depth} * 12px)`;
};

const resolveListRowSizing = (variant: ListRowProps["variant"], hasDescription: boolean) => {
  if (variant === "compact" && !hasDescription) return { rowHeight: "1.75rem", minHeight: undefined };

  return {
    rowHeight: "auto",
    minHeight: variant === "default" ? "2.25rem" : "1.75rem",
  };
};

const createRowBackgroundProps = (input: {
  isSelected: boolean;
  selectedBg: ListRowProps["selectedBg"];
  hoverBg: ListRowProps["hoverBg"];
  tone: NonNullable<ListRowProps["tone"]>;
}) => ({
  bg: input.isSelected ? input.selectedBg : "transparent",
  _hover:
    input.tone === "danger" ? { boxShadow: "inset 0 0 0 1px var(--chakra-colors-red-500)" } : { bg: input.hoverBg },
});

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
    menuItems,
    menuPlacement,
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
    selectedBg = "bg.menu-item.selected",
    hoverBg = "bg.menu-item.hover",
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
  const [menuOpen, setMenuOpen] = useState(false);

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
    menuItems,
    menuPlacement,
    contextMenuItems,
    actions,
    children,
    onActivate,
  };

  const dragProps = { draggable, onDragStart, onDragOver, onDragEnd, onDrop };

  const hasChildren = (item.children?.length ?? 0) > 0 || item.isContainer === true;
  const hasMenuItems = (item.menuItems?.length ?? 0) > 0;
  const showChevron = showExpandToggle && hasChildren;
  const isDisabled = item.disabled === true;

  const handleActivate = () => {
    if (isDisabled) return;
    if (hasMenuItems) return;
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

  const handleMenuClick = (event: ReactMouseEvent<HTMLElement>) => {
    onClick?.(event);
    if (event.defaultPrevented) return;

    if (isDisabled) {
      event.preventDefault();
      return;
    }

    setMenuOpen((current) => !current);
  };

  const paddingLeft = computePaddingLeft(depth);
  const verticalPadding = variant === "default" ? "xs" : "2xs";
  const hasDescription = item.description !== undefined;
  const activationProps = hasMenuItems ? { onClick: handleMenuClick } : { onClick: handleClick };
  const { rowHeight, minHeight } = resolveListRowSizing(variant, hasDescription);

  const rowProps = {
    ...rootProps,
    role: hasMenuItems ? ("button" as const) : ("option" as const),
    "aria-selected": isSelected,
    "aria-expanded": showChevron ? isExpanded : undefined,
    className: className ? `group ${className}` : "group",
    width: "full",
    minWidth: "0",
    maxWidth: "full",
    height: rowHeight,
    minHeight,
    display: "flex" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    gap: "xs" as const,
    px: "sm",
    py: verticalPadding,
    pl: paddingLeft,
    borderRadius: "0" as const,
    ...createRowBackgroundProps({ isSelected, selectedBg, hoverBg, tone }),
    cursor: isDisabled ? ("not-allowed" as const) : ("pointer" as const),
    overflow: "hidden" as const,
    textAlign: "left" as const,
    color: "inherit",
    textDecoration: "none",
  };

  const content = (
    <ListRowContent
      item={item}
      isExpanded={isExpanded}
      showChevron={showChevron}
      isDisabled={isDisabled}
      tone={tone}
      variant={variant}
    />
  );

  const wrapWithContextMenu = (children: ReactElement) => {
    if (!item.contextMenuItems || item.contextMenuItems.length === 0) return children;

    const contextActions = item.contextMenuItems.map((entry) => ({
      key: entry.id,
      label: entry.label,
      icon: typeof entry.icon === "function" ? <Icon as={entry.icon} boxSize="16px" /> : entry.icon,
      endContent: entry.endContent,
      isDisabled: entry.disabled,
      onClick: () => entry.onAction?.(),
    }));

    return (
      <ResourceContextMenu actions={contextActions} contentMinWidth="180px">
        {children}
      </ResourceContextMenu>
    );
  };

  const wrapWithMenu = (children: ReactElement) => {
    if (!item.menuItems || item.menuItems.length === 0) return children;

    return (
      <ListRowMenu
        items={item.menuItems}
        open={menuOpen}
        placement={item.menuPlacement}
        onOpenChange={setMenuOpen}
        onSelect={(menuItem) => {
          setMenuOpen(false);
          menuItem.onAction?.();
        }}
      >
        {children}
      </ListRowMenu>
    );
  };

  const wrapWithTooltip = (children: ReactElement) => {
    if (!item.tooltip) return children;
    return <Tooltip content={item.tooltip}>{children}</Tooltip>;
  };

  const wrap = (children: ReactElement) =>
    hasMenuItems ? wrapWithMenu(children) : wrapWithContextMenu(wrapWithTooltip(children));

  if (asChild) {
    return wrap(
      <chakra.div ref={ref} {...rowProps} {...dragProps} {...activationProps} onPointerMove={onPointerMove}>
        {content}
      </chakra.div>,
    );
  }
  if (item.href && !showChevron && !isDisabled && !hasMenuItems) {
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
      {...activationProps}
      onPointerMove={onPointerMove}
    >
      {content}
    </chakra.button>,
  );
});
