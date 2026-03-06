import type { IconProps } from "@chakra-ui/react";
import { Badge, MenuItem as ChakraMenuItem, Flex, Icon, Stack, Text } from "@chakra-ui/react";
import type { ComponentProps, MouseEvent as ReactMouseEvent, ReactNode } from "react";
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

export interface MenuItemProps {
  id?: string;
  children?: ReactNode;
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
    primaryLabel,
    tooltipLabel,
    secondaryLabel,
    leftIcon = null,
    leftSlot,
    rightIcon,
    leftIconColor = "fg",
    rightIconColor = "fg",
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
  const backgroundColor = isSelected ? "bg.emphasized" : undefined;
  const resolvedLeftIconSize = leftIconSize ?? variantStyles.iconSize;
  const resolvedRightIconSize = rightIconSize ?? variantStyles.iconSize;
  const isRightIconInteractive = Boolean(onRightIconClick && rightIcon);

  const handleRightIconMouseDown = (event: ReactMouseEvent<HTMLElement>) => {
    if (!isRightIconInteractive) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
  };

  const handleRightIconClick = (event: ReactMouseEvent<HTMLElement>) => {
    if (!isRightIconInteractive || !onRightIconClick) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    onRightIconClick();
  };

  return (
    <ChakraMenuItem
      id={id}
      ref={setRefElement}
      tabIndex={tabIndex}
      disabled={isDisabled}
      aria-selected={isSelected}
      paddingX={variantStyles.paddingX}
      paddingY={variantStyles.paddingY}
      onClick={onClick}
      onMouseDown={onMouseDown}
      onMouseEnter={onMouseEnter}
      height="auto"
      minHeight={variantStyles.minHeight}
      role="option"
      width={width}
      maxWidth={maxWidth ?? "20rem"}
      overflow={"hidden"}
      position="relative"
      cursor={isDisabled ? "default" : "pointer"}
      value={id ?? primaryLabel}
      bg={backgroundColor}
      _hover={{ bg: "bg.muted" }}
      _focus={{ bg: "bg.muted" }}
    >
      <Flex justifyContent="space-between" alignItems="center" gap="xs" flex="1">
        <Tooltip positioning={{ placement: "right" }} content={tooltipLabel} disabled={!tooltipLabel}>
          <Stack gap="2xs">
            <Flex alignItems="flex-start" gap="xs" flex="1">
              {leftSlot ? (
                leftSlot
              ) : leftIcon ? (
                <Icon as={leftIcon} boxSize={resolvedLeftIconSize} color={leftIconColor} />
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
                color="fg.muted"
              >
                {secondaryLabel}
              </Text>
            )}
          </Stack>
        </Tooltip>
        <Flex justifyContent="flex-end" color="fg">
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
                <Icon as={rightIcon} boxSize={resolvedRightIconSize} color={rightIconColor} />
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
    </ChakraMenuItem>
  );
};
