import type { TagOption, TagType, TicketStatusColor, TicketTag } from "@/features/ticket-list/types";

export interface DraftOption {
  id: string;
  name: string;
  color: TicketStatusColor;
  icon: string | null;
  description: string;
  sortOrder: number;
  isNew?: boolean;
}

interface UpdateOptionInput {
  tagId: string;
  optionId: string;
  name?: string;
  color?: string;
  icon?: string | null;
  sort_order?: number;
  description?: string | null;
}

interface SaveTagInput {
  tag: TicketTag;
  draftName: string;
  draftType: TagType;
  draftOptions: DraftOption[];
  deletedOptionIds: Set<string>;
  updateTag: (input: { tagId: string; name?: string; type?: string }) => Promise<unknown>;
  createOption: (input: {
    tagId: string;
    name: string;
    color: string;
    icon?: string;
    description?: string;
  }) => Promise<unknown>;
  updateOption: (input: UpdateOptionInput) => Promise<unknown>;
  deleteOption: (input: { tagId: string; optionId: string }) => Promise<unknown>;
}

const buildOptionChanges = (draft: DraftOption, original: TagOption, tagId: string): UpdateOptionInput | null => {
  const update: UpdateOptionInput = { tagId, optionId: draft.id };
  let changed = false;

  if (draft.name !== original.name) {
    update.name = draft.name;
    changed = true;
  }
  if (draft.color !== original.color) {
    update.color = draft.color;
    changed = true;
  }
  if (draft.icon !== (original.icon ?? null)) {
    update.icon = draft.icon;
    changed = true;
  }
  if (draft.description !== (original.description ?? "")) {
    update.description = draft.description || null;
    changed = true;
  }
  if (draft.sortOrder !== original.sortOrder) {
    update.sort_order = draft.sortOrder;
    changed = true;
  }

  return changed ? update : null;
};

export const saveTag = async (input: SaveTagInput) => {
  const { tag, draftName, draftType, draftOptions, deletedOptionIds } = input;

  if (draftName !== tag.name || draftType !== tag.type) {
    await input.updateTag({ tagId: tag.id, name: draftName, type: draftType });
  }

  for (const id of deletedOptionIds) {
    await input.deleteOption({ tagId: tag.id, optionId: id });
  }

  for (const draft of draftOptions) {
    if (draft.isNew) {
      await input.createOption({
        tagId: tag.id,
        name: draft.name,
        color: draft.color,
        icon: draft.icon || undefined,
        description: draft.description || undefined,
      });
      continue;
    }

    const original = tag.options.find((o) => o.id === draft.id);
    if (!original) continue;

    const changes = buildOptionChanges(draft, original, tag.id);
    if (changes) await input.updateOption(changes);
  }
};

export const toDraftOptions = (tag: TicketTag): DraftOption[] =>
  [...tag.options]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((o) => ({
      id: o.id,
      name: o.name,
      color: o.color,
      icon: o.icon ?? null,
      description: o.description ?? "",
      sortOrder: o.sortOrder,
    }));

export const hasDraftChanges = (
  tag: TicketTag,
  draftName: string,
  draftType: TagType,
  draftOptions: DraftOption[],
  deletedOptionIds: Set<string>,
) => {
  if (draftName !== tag.name || draftType !== tag.type || deletedOptionIds.size > 0) return true;

  return draftOptions.some((draft) => {
    if (draft.isNew) return true;
    const original = tag.options.find((o) => o.id === draft.id);
    if (!original) return true;
    return buildOptionChanges(draft, original, tag.id) !== null;
  });
};
