import type { IconProps } from "@chakra-ui/react";
import { Badge, MenuItem as ChakraMenuItem, Flex, Icon, Stack, Text } from "@chakra-ui/react";
import {
  Children,
  type ComponentProps,
  cloneElement,
  type HTMLAttributes,
  isValidElement,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { Tooltip } from "./tooltip";

type ChakraMenuItemProps = ComponentProps<typeof ChakraMenuItem>;
type MenuItemIcon = ComponentProps<typeof Icon>["as"];
type MenuItemIconColor = IconProps["color"];
type MenuItemTagColor = ComponentProps<typeof Badge>["colorPalette"];
type MenuItemTagVariant = ComponentProps<typeof Badge>["variant"];
type MenuItemVariant = "default" | "compact";

const menuItemVariantStyles = {
  default: {
    paddingX: "sm",
    paddingY: "xs",
    minHeight: "2rem",
    iconSize: "19px",
    primaryTextStyle: "label/M/regular",
    secondaryMarginLeft: "2px",
    secondaryTextStyle: "label/XS/regular",
  },
  compact: {
    paddingX: "xs",
    paddingY: "2xs",
    minHeight: "1.75rem",
    iconSize: "16px",
    primaryTextStyle: "label/S/regular",
    secondaryMarginLeft: "0",
    secondaryTextStyle: "label/XS/regular",
  },
} as const;

interface MenuItemContentProps {
  primaryLabel: string;
  secondaryLabel?: string;
  tooltipLabel?: ReactNode;
  leftIcon?: MenuItemIcon | null;
  leftSlot?: ReactNode;
  rightIcon?: MenuItemIcon | null;
  leftIconColor: MenuItemIconColor;
  rightIconColor: MenuItemIconColor;
  leftIconSize: string;
  rightIconSize: string;
  rightIconAriaLabel?: string;
  rightTooltipLabel?: ReactNode;
  onRightIconClick?: () => void;
  tagLabel?: ReactNode;
  tagColorPalette: MenuItemTagColor;
  tagVariant: MenuItemTagVariant;
  variant: MenuItemVariant;
}

const MenuItemContent = (props: MenuItemContentProps) => {
  const {
    primaryLabel,
    tooltipLabel,
    secondaryLabel,
    leftIcon,
    leftSlot,
    rightIcon,
    leftIconColor,
    rightIconColor,
    leftIconSize,
    rightIconSize,
    rightIconAriaLabel,
    rightTooltipLabel,
    onRightIconClick,
    tagLabel,
    tagColorPalette,
    tagVariant,
    variant,
  } = props;

  const variantStyles = menuItemVariantStyles[variant];
  const isRightIconInteractive = Boolean(onRightIconClick && rightIcon);

  const handleRightIconMouseDown = (event: ReactMouseEvent<HTMLElement>) => {
    if (!isRightIconInteractive) return;
    event.preventDefault();
    event.stopPropagation();
  };

  const handleRightIconClick = (event: ReactMouseEvent<HTMLElement>) => {
    if (!isRightIconInteractive || !onRightIconClick) return;
    event.preventDefault();
    event.stopPropagation();
    onRightIconClick();
  };

  return (
    <>
      <Flex justifyContent="space-between" alignItems="center" gap="xs" flex="1">
        <Tooltip positioning={{ placement: "right" }} content={tooltipLabel} disabled={!tooltipLabel}>
          <Stack gap="2xs">
            <Flex alignItems="flex-start" gap="xs" flex="1">
              {leftSlot ? (
                leftSlot
              ) : leftIcon ? (
                <Icon as={leftIcon} boxSize={leftIconSize} color={leftIconColor} />
              ) : null}
              <Text lineClamp={1} textOverflow="ellipsis" textStyle={variantStyles.primaryTextStyle}>
                {primaryLabel}
              </Text>
            </Flex>
            {secondaryLabel && (
              <Text
                ml={variantStyles.secondaryMarginLeft}
                lineClamp={1}
                textOverflow="ellipsis"
                textStyle={variantStyles.secondaryTextStyle}
                color="fg.menu-item.secondary"
              >
                {secondaryLabel}
              </Text>
            )}
          </Stack>
        </Tooltip>
        <Flex justifyContent="flex-end" color="fg.menu-item.default">
          {rightIcon ? (
            <Tooltip positioning={{ placement: "right" }} content={rightTooltipLabel} disabled={!rightTooltipLabel}>
              <Flex
                as={isRightIconInteractive ? "button" : "div"}
                alignItems="center"
                aria-label={rightIconAriaLabel}
                cursor={isRightIconInteractive ? "pointer" : "default"}
                bg="transparent"
                borderWidth="0"
                padding="0"
                onMouseDown={handleRightIconMouseDown}
                onClick={handleRightIconClick}
              >
                <Icon as={rightIcon} boxSize={rightIconSize} color={rightIconColor} />
              </Flex>
            </Tooltip>
          ) : null}
        </Flex>
      </Flex>
      {tagLabel ? (
        <Badge
          position="absolute"
          top="xs"
          right="sm"
          textStyle="label/XS/medium"
          px="xs"
          py="2px"
          borderRadius="md"
          colorPalette={tagColorPalette}
          variant={tagVariant}
          pointerEvents="none"
        >
          {tagLabel}
        </Badge>
      ) : null}
    </>
  );
};

export interface MenuItemProps {
  id?: string;
  children?: ReactNode;
  /** When true, the single child element becomes the root element (e.g. a Link for cmd+click support). */
  asChild?: boolean;
  isDisabled?: boolean;
  isSelected?: boolean;
  primaryLabel: string;
  secondaryLabel?: string;
  tooltipLabel?: ReactNode;
  leftIcon?: MenuItemIcon | null;
  leftSlot?: ReactNode;
  rightIcon?: MenuItemIcon | null;
  leftIconColor?: MenuItemIconColor;
  rightIconColor?: MenuItemIconColor;
  leftIconSize?: string;
  rightIconSize?: string;
  rightIconAriaLabel?: string;
  rightTooltipLabel?: ReactNode;
  onRightIconClick?: () => void;
  tagLabel?: ReactNode;
  tagColorPalette?: MenuItemTagColor;
  tagVariant?: MenuItemTagVariant;
  variant?: MenuItemVariant;
  tabIndex?: number;
  width?: ChakraMenuItemProps["width"];
  maxWidth?: ChakraMenuItemProps["maxWidth"];
  setRefElement?: ChakraMenuItemProps["ref"];
  onClick?: ChakraMenuItemProps["onClick"];
  onMouseDown?: ChakraMenuItemProps["onMouseDown"];
  onMouseEnter?: ChakraMenuItemProps["onMouseEnter"];
}

export const MenuItem = (props: MenuItemProps) => {
  const {
    id,
    children,
    asChild,
    primaryLabel,
    tooltipLabel,
    secondaryLabel,
    leftIcon = null,
    leftSlot,
    rightIcon,
    leftIconColor = "fg.menu-item.default",
    rightIconColor = "fg.menu-item.default",
    leftIconSize,
    rightIconSize,
    rightIconAriaLabel,
    rightTooltipLabel,
    onRightIconClick,
    isDisabled,
    isSelected,
    tagLabel,
    tagColorPalette = "yellow",
    tagVariant = "subtle",
    variant = "default",
    tabIndex,
    width,
    maxWidth,
    setRefElement,
  } = props;
  const { onClick, onMouseDown, onMouseEnter } = props;
  const variantStyles = menuItemVariantStyles[variant];
  const backgroundColor = isSelected ? "bg.menu-item.selected" : "bg.menu-item.default";
  const resolvedLeftIconSize = leftIconSize ?? variantStyles.iconSize;
  const resolvedRightIconSize = rightIconSize ?? variantStyles.iconSize;

  const contentProps: MenuItemContentProps = {
    primaryLabel,
    secondaryLabel,
    tooltipLabel,
    leftIcon,
    leftSlot,
    rightIcon,
    leftIconColor,
    rightIconColor,
    leftIconSize: resolvedLeftIconSize,
    rightIconSize: resolvedRightIconSize,
    rightIconAriaLabel,
    rightTooltipLabel,
    onRightIconClick,
    tagLabel,
    tagColorPalette,
    tagVariant,
    variant,
  };

  const commonProps = {
    id,
    ref: setRefElement,
    tabIndex,
    disabled: isDisabled,
    "aria-selected": isSelected,
    paddingX: variantStyles.paddingX,
    paddingY: variantStyles.paddingY,
    height: "auto" as const,
    minHeight: variantStyles.minHeight,
    role: "option" as const,
    width,
    maxWidth: maxWidth ?? "20rem",
    overflow: "hidden" as const,
    position: "relative" as const,
    cursor: isDisabled ? ("default" as const) : ("pointer" as const),
    value: id ?? primaryLabel,
    bg: backgroundColor,
    _hover: { bg: "bg.menu-item.hover" },
    _focus: { bg: "bg.menu-item.focus" },
  };

  if (asChild && children) {
    const child = Children.only(children);
    if (!isValidElement<HTMLAttributes<HTMLElement>>(child)) return null;

    return (
      <ChakraMenuItem asChild {...commonProps}>
        {cloneElement(
          child,
          { style: { textDecoration: "none", color: "inherit" } },
          <MenuItemContent {...contentProps} />,
        )}
      </ChakraMenuItem>
    );
  }

  return (
    <ChakraMenuItem {...commonProps} onClick={onClick} onMouseDown={onMouseDown} onMouseEnter={onMouseEnter}>
      <MenuItemContent {...contentProps} />
    </ChakraMenuItem>
  );
};
