import { Button, Icon, Menu, Stack, Text } from "@chakra-ui/react";
import { ListRow } from "@pstdio/ui";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getIconComponent } from "@/features/project-settings/components/tag-icon-color-picker";
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
  const allOptions = tags.flatMap((tag) => tag.options.map((o) => ({ ...o, tagName: tag.name, tagType: tag.type })));
  const selectedNames = allOptions.filter((o) => selectedTagSet.has(o.id)).map((o) => o.name);
  const selectedLabel = selectedNames.length > 0 ? selectedNames.join(", ") : t("ticketDetail.noTagsSelected");

  const handleOptionToggle = (optionId: string) => {
    if (!onChange) return;

    const option = allOptions.find((o) => o.id === optionId);
    if (!option) return;

    if (option.tagType === "single_select") {
      // For single-select: replace any other option from the same tag
      const sameTagOptionIds = new Set(
        tags.find((t) => t.options.some((o) => o.id === optionId))!.options.map((o) => o.id),
      );
      const otherTagIds = selectedTagIds.filter((id) => !sameTagOptionIds.has(id));

      if (selectedTagSet.has(optionId)) {
        onChange(otherTagIds);
      } else {
        onChange([...otherTagIds, optionId]);
      }
    } else {
      // Multi-select: toggle
      const nextTagIds = selectedTagSet.has(optionId)
        ? selectedTagIds.filter((id) => id !== optionId)
        : [...selectedTagIds, optionId];
      onChange(nextTagIds);
    }
  };

  if (allOptions.length === 0) {
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
          {selectedLabel}
          <Icon as={ChevronDown} color="foreground.tertiary" />
        </Button>
      </Menu.Trigger>
      <Menu.Positioner>
        <Menu.Content minW="220px" bg="bg">
          {tags.map((tag) => (
            <Stack key={tag.id} gap="0">
              <Text textStyle="paragraph/XS/regular" color="fg.muted" px="sm" pt="sm" pb="2xs">
                {tag.name} {tag.type === "single_select" ? "(single)" : "(multi)"}
              </Text>
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
                    isSelected={selectedTagSet.has(option.id)}
                    onActivate={() => handleOptionToggle(option.id)}
                  />
                </Menu.Item>
              ))}
            </Stack>
          ))}
        </Menu.Content>
      </Menu.Positioner>
    </Menu.Root>
  );
};
