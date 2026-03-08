import { Button, Icon, Menu } from "@chakra-ui/react";
import { ChevronDown } from "lucide-react";
import type { TicketTag } from "@/features/ticket-list/types";

interface TagSelectorProps {
  tags: TicketTag[];
  selectedTagIds: string[];
  onChange?: (tagIds: string[]) => void;
  isDisabled?: boolean;
}

export const TagSelector = (props: TagSelectorProps) => {
  const { tags, selectedTagIds, onChange, isDisabled = false } = props;

  const selectedTagSet = new Set(selectedTagIds);
  const selectedTagNames = tags.filter((tag) => selectedTagSet.has(tag.id)).map((tag) => tag.name);
  const selectedTagsLabel = selectedTagNames.length > 0 ? selectedTagNames.join(", ") : "No tags selected";

  const handleTagToggle = (tagId: string) => {
    if (!onChange) {
      return;
    }

    const nextTagIds = selectedTagSet.has(tagId)
      ? selectedTagIds.filter((id) => id !== tagId)
      : [...selectedTagIds, tagId];

    onChange(nextTagIds);
  };

  if (tags.length === 0) {
    return (
      <Button size="sm" variant="subtle" disabled>
        No tags
      </Button>
    );
  }

  return (
    <Menu.Root closeOnSelect={false}>
      <Menu.Trigger asChild>
        <Button
          size="sm"
          variant="subtle"
          width="220px"
          justifyContent="space-between"
          _hover={{ bg: "background.tertiary" }}
          disabled={isDisabled || !onChange}
        >
          {selectedTagsLabel}
          <Icon as={ChevronDown} color="foreground.tertiary" />
        </Button>
      </Menu.Trigger>
      <Menu.Positioner>
        <Menu.Content minW="220px" bg="background.primary">
          {tags.map((tag) => (
            <Menu.CheckboxItem
              key={tag.id}
              value={tag.id}
              checked={selectedTagSet.has(tag.id)}
              closeOnSelect={false}
              onCheckedChange={() => handleTagToggle(tag.id)}
              disabled={isDisabled || !onChange}
            >
              {tag.name}
              <Menu.ItemIndicator />
            </Menu.CheckboxItem>
          ))}
        </Menu.Content>
      </Menu.Positioner>
    </Menu.Root>
  );
};
