import { chakra } from "@chakra-ui/react";
import {
  forwardRef,
  type ReactElement,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  useId,
  useState,
} from "react";
import type { ListRowItem, ListRowProps } from "./list-row.types";
import { ListRowChrome } from "./list-row-chrome";
import { ListRowContent } from "./list-row-content";
import { computePaddingLeft, createListRowRootProps, resolveListRowSizing } from "./list-row-root-props";

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
    showContextMenuTrigger = true,
    variant = "default",
    tone = "default",
    selectedBg = "bg.active",
    hoverBg = "bg.hover",
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
  const labelId = useId();

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
  const hasActions = (item.actions?.length ?? 0) > 0 || (item.contextMenuItems?.length ?? 0) > 0;
  const showChevron = showExpandToggle && hasChildren;
  const isDisabled = item.disabled === true;

  const handleActivate = () => {
    if (isDisabled) return;
    if (hasMenuItems) return;
    if (showChevron) {
      onToggleExpand?.();
      return;
    }
    onActivate?.();
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

  const hasDescription = item.description !== undefined;
  const paddingLeft = computePaddingLeft(depth);
  const verticalPadding = variant === "default" || hasDescription ? "xs" : "2xs";
  const activationProps = hasMenuItems ? { onClick: handleMenuClick } : { onClick: handleClick };
  const { rowHeight, minHeight } = resolveListRowSizing(variant, hasDescription);
  const rowRole = roleProp ?? (hasMenuItems ? "button" : "option");

  const rowProps = createListRowRootProps({
    rootProps,
    labelId,
    hasEndContent: Boolean(item.endContent),
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
    variant,
  });

  const content = (
    <ListRowContent
      labelId={labelId}
      item={item}
      isExpanded={isExpanded}
      showChevron={showChevron}
      isDisabled={isDisabled}
      tone={tone}
      variant={variant}
      showContextMenuTrigger={showContextMenuTrigger}
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
