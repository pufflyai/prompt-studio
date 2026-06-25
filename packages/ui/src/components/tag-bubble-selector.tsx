import { Button, Icon, Menu, Portal, Text } from "@chakra-ui/react";
import { Check, ChevronDown } from "lucide-react";
import type { SyntheticEvent } from "react";

import { getIconComponent } from "./icon-color-picker";
import { ListRow } from "./list-row/list-row";

export type TagBubbleSelectionMode = "single" | "multiple";

export interface TagBubbleSelectorOption {
  id: string;
  label: string;
  color?: string;
  icon?: string | null;
  description?: string | null;
}

type BubbleInteractionHandler = (event: SyntheticEvent) => void;

interface TagBubbleSelectorInteractionProps {
  onClickCapture?: BubbleInteractionHandler;
  onClick?: BubbleInteractionHandler;
  onPointerDownCapture?: BubbleInteractionHandler;
  onPointerDown?: BubbleInteractionHandler;
  onKeyDown?: BubbleInteractionHandler;
}

export interface TagBubbleSelectorProps {
  label: string;
  options: TagBubbleSelectorOption[];
  selectedOptionIds: string[];
  selectionMode?: TagBubbleSelectionMode;
  selectedLabel?: string;
  disabled?: boolean;
  size?: "xs" | "sm";
  interactionProps?: TagBubbleSelectorInteractionProps;
  onSelectedOptionIdsChange?: (nextIds: string[]) => void;
}

export const resolveTagBubbleSelection = (
  selectedOptionIds: string[],
  optionId: string,
  selectionMode: TagBubbleSelectionMode = "multiple",
) => {
  const isSelected = selectedOptionIds.includes(optionId);
  if (selectionMode === "single") return isSelected ? [] : [optionId];
  return isSelected ? selectedOptionIds.filter((id) => id !== optionId) : [...selectedOptionIds, optionId];
};

export const TagBubbleSelector = (props: TagBubbleSelectorProps) => {
  const {
    label,
    options,
    selectedOptionIds,
    selectionMode = "multiple",
    selectedLabel,
    disabled,
    size = "xs",
    interactionProps,
    onSelectedOptionIdsChange,
  } = props;
  const isDisabled = disabled || !onSelectedOptionIdsChange;
  const selectedSet = new Set(selectedOptionIds);
  const selectedOptions = options.filter((option) => selectedSet.has(option.id));
  const hasSelection = selectedOptionIds.length > 0;
  const triggerIcon = selectedOptions.length === 1 ? selectedOptions[0] : null;
  const selectedOptionsLabel = selectedOptions.map((option) => option.label).join(", ");
  const triggerLabel = hasSelection ? (selectedLabel ?? (selectedOptionsLabel || label)) : label;

  const handleToggle = (optionId: string) => {
    onSelectedOptionIdsChange?.(resolveTagBubbleSelection(selectedOptionIds, optionId, selectionMode));
  };

  if (options.length === 0) return null;

  return (
    <Menu.Root closeOnSelect={false}>
      <Menu.Trigger asChild>
        <Button
          size={size}
          variant="subtle"
          gap="2xs"
          maxW="full"
          minW="0"
          justifyContent="space-between"
          disabled={isDisabled}
          {...interactionProps}
        >
          {triggerIcon ? (
            <Icon as={getIconComponent(triggerIcon.icon)} boxSize="14px" color={`${triggerIcon.color ?? "gray"}.500`} />
          ) : null}
          <Text as="span" truncate>
            {triggerLabel}
          </Text>
          <Icon as={ChevronDown} boxSize="12px" color="fg.muted" flexShrink={0} />
        </Button>
      </Menu.Trigger>
      <Portal>
        <Menu.Positioner>
          <Menu.Content minW="180px" bg="bg" p="0" gap="0" {...interactionProps}>
            {options.map((option) => {
              const isSelected = selectedSet.has(option.id);
              return (
                <Menu.Item key={option.id} value={option.id} asChild>
                  <ListRow
                    asChild
                    role="menuitem"
                    variant="compact"
                    id={option.id}
                    label={option.label}
                    icon={<Icon as={getIconComponent(option.icon)} boxSize="16px" />}
                    iconColor={`${option.color ?? "gray"}.500`}
                    tooltip={option.description ?? undefined}
                    disabled={isDisabled}
                    isSelected={isSelected}
                    endContent={isSelected ? <Check size={14} /> : undefined}
                    onActivate={() => handleToggle(option.id)}
                    {...interactionProps}
                  />
                </Menu.Item>
              );
            })}
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
};
