import { Flex, Text, Tooltip } from "@chakra-ui/react";

interface ReferenceMenuItemProps {
  id: string;
  isSelected: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
  primaryLabel: string;
  secondaryLabel?: string;
  setRefElement: (element: HTMLDivElement) => void;
  tabIndex: number;
}

export function ReferenceMenuItem(props: ReferenceMenuItemProps) {
  const { id, isSelected, onClick, onMouseEnter, setRefElement, secondaryLabel, primaryLabel, tabIndex = -1 } = props;

  return (
    <Flex
      direction="column"
      cursor="pointer"
      gap="2xs"
      padding="2xs"
      paddingX="sm"
      bg={isSelected ? "bg.active" : "transparent"}
      _hover={{ bg: isSelected ? "bg.active" : "bg.hover" }}
      tabIndex={tabIndex}
      ref={setRefElement}
      role="option"
      aria-selected={isSelected}
      id={id}
      onMouseEnter={onMouseEnter}
      onClick={onClick}
    >
      <Tooltip.Root>
        <Tooltip.Trigger>
          <Text mt="1px" lineClamp={1} textOverflow="ellipsis" textStyle="label/M/regular">
            {primaryLabel}
          </Text>
        </Tooltip.Trigger>
        <Tooltip.Positioner>
          <Tooltip.Content>{primaryLabel}</Tooltip.Content>
        </Tooltip.Positioner>
      </Tooltip.Root>
      {secondaryLabel && (
        <Text lineClamp={2} textOverflow="ellipsis" textStyle="label/S/regular" color="fg.muted">
          {secondaryLabel}
        </Text>
      )}
    </Flex>
  );
}
