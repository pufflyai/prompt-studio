import { Button, Icon, Menu } from "@chakra-ui/react";
import { MenuItem } from "@pstdio/ui";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TicketTag } from "@/features/ticket-list/types";

interface TagSelectorProps {
  tags: TicketTag[];
  selectedTagIds: string[];
  onChange?: (tagIds: string[]) => void;
  isDisabled?: boolean;
}

export const TagSelector = (props: TagSelectorProps) => {
  const { tags, selectedTagIds, onChange, isDisabled = false } = props;
  const { t } = useTranslation("tickets");

  const selectedTagSet = new Set(selectedTagIds);
  const selectedTagNames = tags.filter((tag) => selectedTagSet.has(tag.id)).map((tag) => tag.name);
  const selectedTagsLabel =
    selectedTagNames.length > 0 ? selectedTagNames.join(", ") : t("ticketDetail.noTagsSelected");

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
        {t("ticketDetail.noTags")}
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
        <Menu.Content minW="220px" bg="bg">
          {tags.map((tag) => (
            <MenuItem
              key={tag.id}
              id={tag.id}
              primaryLabel={tag.name}
              isSelected={selectedTagSet.has(tag.id)}
              isDisabled={isDisabled || !onChange}
              onClick={() => handleTagToggle(tag.id)}
            />
          ))}
        </Menu.Content>
      </Menu.Positioner>
    </Menu.Root>
  );
};
