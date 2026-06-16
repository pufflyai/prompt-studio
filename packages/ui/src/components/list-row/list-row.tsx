import { chakra } from "@chakra-ui/react";
import {
  type ComponentPropsWithoutRef,
  forwardRef,
  type ReactElement,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  useState,
} from "react";
import type { ListRowItem, ListRowProps } from "./list-row.types";
import { ListRowChrome } from "./list-row-chrome";
import { ListRowContent } from "./list-row-content";

type ListRowRootProps = ComponentPropsWithoutRef<typeof chakra.div>;

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

const createListRowRootProps = (input: {
  rootProps: ListRowRootProps;
  rowRole: ListRowRootProps["role"];
  className?: string;
  isSelected: boolean;
  isExpanded: boolean;
  showChevron: boolean;
  rowHeight: ListRowRootProps["height"];
  minHeight: ListRowRootProps["minHeight"];
  verticalPadding: ListRowRootProps["py"];
  paddingLeft: ListRowRootProps["pl"];
  selectedBg: ListRowProps["selectedBg"];
  hoverBg: ListRowProps["hoverBg"];
  tone: NonNullable<ListRowProps["tone"]>;
  isDisabled: boolean;
}) => ({
  ...input.rootProps,
  role: input.rowRole,
  "aria-selected": input.rootProps["aria-selected"] ?? (input.rowRole === "option" ? input.isSelected : undefined),
  "aria-expanded": input.showChevron ? input.isExpanded : undefined,
  className: input.className ? `group ${input.className}` : "group",
  width: "full",
  minWidth: "0",
  maxWidth: "full",
  height: input.rowHeight,
  minHeight: input.minHeight,
  display: "flex" as const,
  alignItems: "center" as const,
  justifyContent: "space-between" as const,
  gap: "xs" as const,
  px: "sm",
  py: input.verticalPadding,
  pl: input.paddingLeft,
  borderRadius: "0" as const,
  ...createRowBackgroundProps({ ...input }),
  cursor: input.isDisabled ? ("not-allowed" as const) : ("pointer" as const),
  overflow: "hidden" as const,
  textAlign: "left" as const,
  color: "inherit",
  textDecoration: "none",
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
    role: roleProp,
    onToggleExpand,
    onPointerMove,
    draggable,
    onDragStart,
    onDragOver,
    onDragEnd,
    onDrop,
    onClick,
    onKeyDown,
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
  const hasActions = (item.actions?.length ?? 0) > 0;
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

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;
    if (event.key !== "Enter" && event.key !== " ") return;

    event.preventDefault();
    if (isDisabled) return;
    if (hasMenuItems) {
      setMenuOpen((current) => !current);
      return;
    }

    handleActivate();
  };

  const paddingLeft = computePaddingLeft(depth);
  const verticalPadding = variant === "default" ? "xs" : "2xs";
  const hasDescription = item.description !== undefined;
  const activationProps = hasMenuItems ? { onClick: handleMenuClick } : { onClick: handleClick };
  const { rowHeight, minHeight } = resolveListRowSizing(variant, hasDescription);
  const rowRole = roleProp ?? (hasMenuItems ? "button" : "option");

  const rowProps = createListRowRootProps({
    rootProps,
    rowRole,
    className,
    isSelected,
    isExpanded,
    showChevron,
    rowHeight,
    minHeight,
    verticalPadding,
    paddingLeft,
    selectedBg,
    hoverBg,
    tone,
    isDisabled,
  });

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

  const wrap = (children: ReactElement) => (
    <ListRowChrome
      item={item}
      menuOpen={menuOpen}
      onMenuOpenChange={setMenuOpen}
      onMenuSelect={(menuItem) => {
        setMenuOpen(false);
        menuItem.onAction?.();
      }}
    >
      {children}
    </ListRowChrome>
  );

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

  if (hasActions) {
    return wrap(
      <chakra.div
        ref={ref}
        aria-disabled={isDisabled || undefined}
        {...rowProps}
        {...dragProps}
        {...activationProps}
        tabIndex={rootProps.tabIndex ?? 0}
        onKeyDown={handleKeyDown}
        onPointerMove={onPointerMove}
      >
        {content}
      </chakra.div>,
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
