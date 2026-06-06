import { Button, Icon, Menu } from "@chakra-ui/react";
import { getIconComponent, ListRow } from "@pstdio/ui";
import { ChevronDown } from "lucide-react";

export interface TagSelectorOption {
  id: string;
  name: string;
  color: string;
  icon: string | null;
  description?: string | null;
}

export interface TagSelectorTag {
  id: string;
  name: string;
  type: "single_select" | "multi_select";
  options: TagSelectorOption[];
}

interface SingleTagSelectorProps {
  tag: TagSelectorTag;
  selectedOptionIds: string[];
  onChange?: (nextIds: string[]) => void;
  isDisabled?: boolean;
  size?: "xs" | "sm";
}

// Ported from the old dashboard's ticket properties tag selector. `onChange`
// receives the full next tag-id selection (other tags preserved) so a single
// `set-ticket-tags` call replaces the ticket's tags.
export const SingleTagSelector = (props: SingleTagSelectorProps) => {
  const { tag, selectedOptionIds, onChange, isDisabled = false, size = "sm" } = props;

  const selectedSet = new Set(selectedOptionIds);
  const tagOptionIds = new Set(tag.options.map((option) => option.id));
  const selectedForTag = tag.options.filter((option) => selectedSet.has(option.id));
  const label = selectedForTag.length > 0 ? selectedForTag.map((option) => option.name).join(", ") : tag.name;
  const triggerIcon = selectedForTag.length === 1 ? selectedForTag[0] : null;

  const handleToggle = (optionId: string) => {
    if (!onChange) return;

    const otherTagIds = selectedOptionIds.filter((id) => !tagOptionIds.has(id));

    if (tag.type === "single_select") {
      onChange(selectedSet.has(optionId) ? otherTagIds : [...otherTagIds, optionId]);
      return;
    }

    const nextForTag = selectedSet.has(optionId)
      ? selectedOptionIds.filter((id) => id !== optionId)
      : [...selectedOptionIds, optionId];
    onChange(nextForTag);
  };

  if (tag.options.length === 0) return null;

  return (
    <Menu.Root closeOnSelect={tag.type === "single_select"}>
      <Menu.Trigger asChild>
        <Button size={size} variant="subtle" justifyContent="space-between" disabled={isDisabled || !onChange}>
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
            <Menu.Item key={option.id} value={option.id} role="option" asChild>
              <ListRow
                asChild
                variant="compact"
                id={option.id}
                label={option.name}
                icon={<Icon as={getIconComponent(option.icon)} boxSize="16px" />}
                iconColor={`${option.color}.500`}
                tooltip={option.description ?? undefined}
                disabled={isDisabled || !onChange}
                isSelected={selectedSet.has(option.id)}
                onActivate={() => handleToggle(option.id)}
              />
            </Menu.Item>
          ))}
        </Menu.Content>
      </Menu.Positioner>
    </Menu.Root>
  );
};
