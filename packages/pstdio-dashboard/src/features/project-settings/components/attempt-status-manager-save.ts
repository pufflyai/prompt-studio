import type { AttemptStatusOption } from "../hooks/use-attempt-statuses";

export interface DraftAttemptStatus {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
  isDefault: boolean;
  isNew?: boolean;
}

interface UpdateInput {
  id: string;
  name?: string;
  color?: string;
  sort_order?: number;
}

interface SaveInput {
  original: AttemptStatusOption[];
  drafts: DraftAttemptStatus[];
  deletedIds: Set<string>;
  newDefaultId: string | null;
  createStatus: (input: { name: string; color: string }) => Promise<unknown>;
  updateStatus: (input: UpdateInput) => Promise<unknown>;
  setDefaultStatus: (id: string) => Promise<unknown>;
  deleteStatus: (id: string) => Promise<unknown>;
}

const buildChanges = (draft: DraftAttemptStatus, original: AttemptStatusOption): UpdateInput | null => {
  const update: UpdateInput = { id: draft.id };
  let changed = false;

  if (draft.name !== original.name) {
    update.name = draft.name;
    changed = true;
  }
  if (draft.color !== original.color) {
    update.color = draft.color;
    changed = true;
  }
  if (draft.sortOrder !== original.sortOrder) {
    update.sort_order = draft.sortOrder;
    changed = true;
  }

  return changed ? update : null;
};

export const saveAttemptStatuses = async (input: SaveInput) => {
  const { original, drafts, deletedIds, newDefaultId } = input;

  for (const id of deletedIds) {
    await input.deleteStatus(id);
  }

  for (const draft of drafts) {
    if (draft.isNew) {
      await input.createStatus({ name: draft.name, color: draft.color });
      continue;
    }

    const orig = original.find((s) => s.id === draft.id);
    if (!orig) continue;

    const changes = buildChanges(draft, orig);
    if (changes) await input.updateStatus(changes);
  }

  if (newDefaultId) {
    await input.setDefaultStatus(newDefaultId);
  }
};

export const toDraftAttemptStatuses = (statuses: AttemptStatusOption[]): DraftAttemptStatus[] =>
  [...statuses]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((s) => ({
      id: s.id,
      name: s.name,
      color: s.color,
      sortOrder: s.sortOrder,
      isDefault: s.isDefault,
    }));

export const hasAttemptStatusChanges = (
  original: AttemptStatusOption[],
  drafts: DraftAttemptStatus[],
  deletedIds: Set<string>,
  newDefaultId: string | null,
) => {
  if (deletedIds.size > 0 || newDefaultId !== null) return true;

  return drafts.some((draft) => {
    if (draft.isNew) return true;
    const orig = original.find((s) => s.id === draft.id);
    if (!orig) return true;
    return buildChanges(draft, orig) !== null;
  });
};
