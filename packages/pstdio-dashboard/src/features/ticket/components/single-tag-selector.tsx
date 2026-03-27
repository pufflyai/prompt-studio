import { Button, Icon, Menu } from "@chakra-ui/react";
import { MenuItem } from "@pstdio/ui";
import { ChevronDown } from "lucide-react";
import { getIconComponent } from "@/features/project-settings/components/tag-icon-color-picker";
import type { TicketTag } from "@/features/ticket-list/types";

interface SingleTagSelectorProps {
  tag: TicketTag;
  selectedOptionIds: string[];
  onChange?: (nextIds: string[]) => void;
  isDisabled?: boolean;
  size?: "xs" | "sm";
  variant?: "subtle" | "outline";
}

export const SingleTagSelector = (props: SingleTagSelectorProps) => {
  const { tag, selectedOptionIds, onChange, isDisabled = false, size = "sm", variant = "subtle" } = props;

  const selectedSet = new Set(selectedOptionIds);
  const tagOptionIds = new Set(tag.options.map((o) => o.id));
  const selectedForTag = tag.options.filter((o) => selectedSet.has(o.id));
  const label = selectedForTag.length > 0 ? selectedForTag.map((o) => o.name).join(", ") : tag.name;
  const triggerIcon = selectedForTag.length === 1 ? selectedForTag[0] : null;

  const handleToggle = (optionId: string) => {
    if (!onChange) return;

    const otherTagIds = selectedOptionIds.filter((id) => !tagOptionIds.has(id));

    if (tag.type === "single_select") {
      onChange(selectedSet.has(optionId) ? otherTagIds : [...otherTagIds, optionId]);
    } else {
      const nextForTag = selectedSet.has(optionId)
        ? selectedOptionIds.filter((id) => id !== optionId)
        : [...selectedOptionIds, optionId];
      onChange(nextForTag);
    }
  };

  if (tag.options.length === 0) return null;

  return (
    <Menu.Root closeOnSelect={tag.type === "single_select"}>
      <Menu.Trigger asChild>
        <Button size={size} variant={variant} justifyContent="space-between" disabled={isDisabled || !onChange}>
          {triggerIcon && (
            <Icon as={getIconComponent(triggerIcon.icon)} boxSize="14px" color={`${triggerIcon.color}.500`} />
          )}
          {label}
          <Icon as={ChevronDown} boxSize="12px" color="fg.muted" />
        </Button>
      </Menu.Trigger>
      <Menu.Positioner>
        <Menu.Content bg="bg">
          {tag.options.map((option) => (
            <MenuItem
              key={option.id}
              id={option.id}
              primaryLabel={option.name}
              isSelected={selectedSet.has(option.id)}
              isDisabled={isDisabled || !onChange}
              leftIcon={getIconComponent(option.icon)}
              leftIconColor={`${option.color}.500`}
              tooltipLabel={option.description}
              onClick={() => handleToggle(option.id)}
            />
          ))}
        </Menu.Content>
      </Menu.Positioner>
    </Menu.Root>
  );
};
