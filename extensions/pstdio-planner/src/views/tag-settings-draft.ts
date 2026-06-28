import type { TagEditorValue } from "@pstdio/ui";

export type TagSettingsTagType = "single_select" | "multi_select";

export interface TagSettingsOption {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
  icon?: string | null;
}

export interface TagSettingsTag {
  id: string;
  name: string;
  type: TagSettingsTagType;
  options: TagSettingsOption[];
}

export interface TagSettingsDraft {
  type: TagSettingsTagType;
  options: TagEditorValue[];
  deletedIds: Set<string>;
}

export const DEFAULT_TAG_OPTION_ICON = "circle";

export const tagSettingsCommandIds = {
  updateTag: "pstdio-planner.ticketTag.update",
  createOption: "pstdio-planner.ticketTag.createOption",
  updateOption: "pstdio-planner.ticketTag.updateOption",
  deleteOption: "pstdio-planner.ticketTag.deleteOption",
} as const;

export type TagSettingsCommandId = (typeof tagSettingsCommandIds)[keyof typeof tagSettingsCommandIds];
export type TagSettingsCommandParams = Record<string, string | number | undefined>;
export type RunTagSettingsCommand = (
  commandId: TagSettingsCommandId,
  params: TagSettingsCommandParams,
) => Promise<unknown> | unknown;

export const tagOptionsToEditorValues = (options: TagSettingsOption[]): TagEditorValue[] =>
  options.map((option) => ({
    id: option.id,
    name: option.name,
    color: option.color,
    icon: option.icon,
    sortOrder: option.sortOrder,
  }));

export const createTagSettingsDraft = (tag: TagSettingsTag): TagSettingsDraft => ({
  type: tag.type,
  options: tagOptionsToEditorValues(tag.options),
  deletedIds: new Set(),
});

export const tagSettingsDraftVersion = (tag: TagSettingsTag) =>
  [
    tag.id,
    tag.type,
    ...tag.options.map((option) =>
      [option.id, option.name, option.color, option.icon ?? DEFAULT_TAG_OPTION_ICON, option.sortOrder].join(":"),
    ),
  ].join(":");

const commandIcon = (icon: string | null | undefined) => icon ?? DEFAULT_TAG_OPTION_ICON;

const optionChanged = (original: TagSettingsOption, draft: TagEditorValue) =>
  original.name !== draft.name ||
  original.color !== draft.color ||
  (original.icon ?? DEFAULT_TAG_OPTION_ICON) !== commandIcon(draft.icon);

export const hasTagDraftChanges = (tag: TagSettingsTag, draft: TagSettingsDraft) =>
  tag.type !== draft.type ||
  draft.deletedIds.size > 0 ||
  draft.options.some((option) => {
    if (option.isNew) return true;
    const original = tag.options.find((entry) => entry.id === option.id);
    return !original || optionChanged(original, option);
  });

export const saveTagDraft = async (run: RunTagSettingsCommand, tag: TagSettingsTag, draft: TagSettingsDraft) => {
  for (const optionId of draft.deletedIds) {
    await run(tagSettingsCommandIds.deleteOption, { tagId: tag.id, optionId });
  }

  for (const option of draft.options) {
    if (option.isNew) {
      await run(tagSettingsCommandIds.createOption, {
        tagId: tag.id,
        name: option.name,
        color: option.color,
        icon: commandIcon(option.icon),
      });
      continue;
    }

    const original = tag.options.find((entry) => entry.id === option.id);
    if (!original || !optionChanged(original, option)) continue;
    await run(tagSettingsCommandIds.updateOption, {
      tagId: tag.id,
      optionId: option.id,
      name: option.name,
      color: option.color,
      icon: commandIcon(option.icon),
    });
  }

  if (tag.type !== draft.type) {
    await run(tagSettingsCommandIds.updateTag, { tagId: tag.id, type: draft.type });
  }
};
