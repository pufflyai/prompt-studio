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
  name: string;
  type: TagSettingsTagType;
  options: TagEditorValue[];
  deletedIds: Set<string>;
}

export interface TagDraftOptionCreate {
  name: string;
  color: string;
  icon: string;
}

export interface TagDraftOptionUpdate {
  id: string;
  name: string;
  color: string;
  icon: string;
}

export interface TagDraftPayload {
  tagId: string;
  name?: string;
  type?: TagSettingsTagType;
  optionsToCreate: TagDraftOptionCreate[];
  optionsToUpdate: TagDraftOptionUpdate[];
  optionIdsToDelete: string[];
}

export const DEFAULT_TAG_OPTION_ICON = "circle";

export const tagSettingsCommandIds = {
  applyDraft: "pstdio.pstdio-planner.command.ticket-tag.apply-draft",
} as const;

export type TagSettingsCommandId = (typeof tagSettingsCommandIds)[keyof typeof tagSettingsCommandIds];
export type RunTagSettingsCommand = (
  commandId: TagSettingsCommandId,
  params: Record<string, unknown>,
) => Promise<unknown> | unknown;

export type SaveTagDraftOperation = () => Promise<unknown> | unknown;

export const tagOptionsToEditorValues = (options: TagSettingsOption[]): TagEditorValue[] =>
  options.map((option) => ({
    id: option.id,
    name: option.name,
    color: option.color,
    icon: option.icon,
    sortOrder: option.sortOrder,
  }));

export const createTagSettingsDraft = (tag: TagSettingsTag): TagSettingsDraft => ({
  name: tag.name,
  type: tag.type,
  options: tagOptionsToEditorValues(tag.options),
  deletedIds: new Set(),
});

export const tagSettingsDraftVersion = (tag: TagSettingsTag) =>
  [
    tag.id,
    tag.name,
    tag.type,
    ...tag.options.map((option) =>
      [option.id, option.name, option.color, option.icon ?? DEFAULT_TAG_OPTION_ICON, option.sortOrder].join(":"),
    ),
  ].join(":");

export const tagSettingsDraftsVersion = (tags: TagSettingsTag[]) => JSON.stringify(tags.map(tagSettingsDraftVersion));

const commandIcon = (icon: string | null | undefined) => icon ?? DEFAULT_TAG_OPTION_ICON;

const optionChanged = (original: TagSettingsOption, draft: TagEditorValue) =>
  original.name !== draft.name ||
  original.color !== draft.color ||
  (original.icon ?? DEFAULT_TAG_OPTION_ICON) !== commandIcon(draft.icon);

export const hasTagDraftChanges = (tag: TagSettingsTag, draft: TagSettingsDraft) =>
  tag.name !== draft.name ||
  tag.type !== draft.type ||
  draft.deletedIds.size > 0 ||
  draft.options.some((option) => {
    if (option.isNew) return true;
    const original = tag.options.find((entry) => entry.id === option.id);
    return !original || optionChanged(original, option);
  });

export const buildTagDraftPayload = (tag: TagSettingsTag, draft: TagSettingsDraft): TagDraftPayload => {
  const optionsToCreate: TagDraftOptionCreate[] = [];
  const optionsToUpdate: TagDraftOptionUpdate[] = [];

  for (const option of draft.options) {
    if (option.isNew) {
      optionsToCreate.push({ name: option.name, color: option.color, icon: commandIcon(option.icon) });
      continue;
    }
    const original = tag.options.find((entry) => entry.id === option.id);
    if (!original || !optionChanged(original, option)) continue;
    optionsToUpdate.push({ id: option.id, name: option.name, color: option.color, icon: commandIcon(option.icon) });
  }

  return {
    tagId: tag.id,
    name: tag.name !== draft.name ? draft.name : undefined,
    type: tag.type !== draft.type ? draft.type : undefined,
    optionsToCreate,
    optionsToUpdate,
    optionIdsToDelete: [...draft.deletedIds],
  };
};

// Commits the whole draft (type + option creates/updates/deletes) through a
// single backend command so a mid-save failure cannot leave the tag partially
// updated.
export const saveTagDraft = (run: RunTagSettingsCommand, tag: TagSettingsTag, draft: TagSettingsDraft) => {
  const payload = buildTagDraftPayload(tag, draft);
  return run(tagSettingsCommandIds.applyDraft, {
    tagId: payload.tagId,
    name: payload.name,
    type: payload.type,
    optionsToCreate: payload.optionsToCreate,
    optionsToUpdate: payload.optionsToUpdate,
    optionIdsToDelete: payload.optionIdsToDelete,
  });
};

export const saveTagDraftWithRecovery = async (save: SaveTagDraftOperation, recover: SaveTagDraftOperation) => {
  try {
    return await save();
  } catch (error) {
    await recover();
    throw error;
  }
};
