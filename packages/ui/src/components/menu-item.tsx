import type { MenuItemProps as ChakraMenuItemProps } from "@chakra-ui/react";
import { Icon, Menu } from "@chakra-ui/react";
import {
  Children,
  type ComponentProps,
  cloneElement,
  type HTMLAttributes,
  isValidElement,
  type ReactNode,
} from "react";
import { ListRow } from "./list-row/list-row";
import type { ListRowItem } from "./list-row/list-row.types";

type MenuItemVariant = "default" | "compact";

/** Renders an icon component (e.g. lucide) sized for a menu row's icon slot. */
export const menuIcon = (as: ComponentProps<typeof Icon>["as"], size: string = "16px") => (
  <Icon as={as} boxSize={size} />
);

export interface MenuItemProps {
  item: ListRowItem;
  isSelected?: boolean;
  variant?: MenuItemVariant;
  /** Wrap a single child as the root element (e.g. a Link for cmd+click support). */
  asChild?: boolean;
  children?: ReactNode;
  /** Menu navigation value. Defaults to `item.id`. */
  value?: string;
  width?: ChakraMenuItemProps["width"];
  tabIndex?: number;
  setRefElement?: ComponentProps<typeof Menu.Item>["ref"];
  onMouseDown?: ChakraMenuItemProps["onMouseDown"];
  onMouseEnter?: ChakraMenuItemProps["onMouseEnter"];
}

export const MenuItem = (props: MenuItemProps) => {
  const {
    item,
    isSelected,
    variant = "compact",
    asChild,
    children,
    value,
    width,
    tabIndex,
    setRefElement,
    onMouseDown,
    onMouseEnter,
  } = props;

  const menuProps: ChakraMenuItemProps = {
    value: value ?? item.id,
    tabIndex,
    disabled: item.disabled,
    "aria-selected": isSelected,
    width,
    onMouseDown,
    onMouseEnter,
  };

  const row = <ListRow asChild item={item} variant={variant} isSelected={isSelected} />;

  if (asChild && children) {
    const child = Children.only(children);
    if (!isValidElement<HTMLAttributes<HTMLElement>>(child)) return null;

    return (
      <Menu.Item asChild data-bare ref={setRefElement} {...menuProps}>
        {cloneElement(child, undefined, row)}
      </Menu.Item>
    );
  }

  return (
    <Menu.Item asChild data-bare ref={setRefElement} {...menuProps}>
      {row}
    </Menu.Item>
  );
};
