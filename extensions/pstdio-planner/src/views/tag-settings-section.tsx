import { Button, HStack, Icon } from "@chakra-ui/react";
import { SegmentedControl, TagEditor, type TagEditorValue } from "@pstdio/ui";
import { Trash2 } from "lucide-react";
import {
  DEFAULT_TAG_OPTION_ICON,
  type TagSettingsDraft,
  type TagSettingsTag,
  type TagSettingsTagType,
} from "./tag-settings-draft";

export type Translate = (key: string, defaultValue?: string, args?: Record<string, unknown>) => string;

interface TagSettingsSectionProps {
  tag: TagSettingsTag;
  draft: TagSettingsDraft;
  isSaving?: boolean;
  t: Translate;
  onDraftChange: (draft: TagSettingsDraft) => void;
  onDeleteTag: () => void;
}

const tagTypeOptions = (t: Translate) => [
  { value: "single_select", label: t("settings.ticketTags.singleSelect", "Single") },
  { value: "multi_select", label: t("settings.ticketTags.multiSelect", "Multiple") },
];

export const TagSettingsSection = (props: TagSettingsSectionProps) => {
  const { tag, draft, isSaving, t, onDraftChange, onDeleteTag } = props;

  const removeOption = (option: TagEditorValue) => {
    const deletedIds = option.isNew ? draft.deletedIds : new Set([...draft.deletedIds, option.id]);
    onDraftChange({
      ...draft,
      deletedIds,
      options: draft.options.filter((entry) => entry.id !== option.id),
    });
  };

  return (
    <TagEditor
      title={draft.name}
      onTitleChange={(name) => onDraftChange({ ...draft, name })}
      values={draft.options}
      onValuesChange={(options) => onDraftChange({ ...draft, options })}
      onDeleteValue={removeOption}
      isSaving={isSaving}
      defaultAddIcon={DEFAULT_TAG_OPTION_ICON}
      addLabel={t("settings.ticketTags.addOption", "Add option")}
      addName={t("settings.ticketTags.newOptionName", "New option")}
      deleteHeadline={t("settings.ticketTags.deleteOptionHeadline", "Delete tag option?")}
      deleteNotificationText={(option) =>
        t("settings.ticketTags.deleteOptionNotificationText", 'Remove the "{{option}}" option from "{{tag}}".', {
          option: option.name,
          tag: tag.name,
        })
      }
      deleteButtonText={t("settings.ticketTags.deleteOption", "Delete option")}
      headerActions={
        <HStack gap="xs">
          <SegmentedControl
            options={tagTypeOptions(t)}
            value={draft.type}
            disabled={isSaving}
            aria-label={t("settings.ticketTags.selectionMode", "Selection mode")}
            onValueChange={(type) => onDraftChange({ ...draft, type: type as TagSettingsTagType })}
          />
          <Button
            size="xs"
            variant="ghost"
            color="fg.subtle"
            _hover={{ color: "fg.error", bg: "bg.error" }}
            disabled={isSaving}
            aria-label={t("settings.ticketTags.deleteTag", "Delete tag")}
            onClick={onDeleteTag}
          >
            <Icon as={Trash2} boxSize="icon-xs" />
          </Button>
        </HStack>
      }
    />
  );
};
