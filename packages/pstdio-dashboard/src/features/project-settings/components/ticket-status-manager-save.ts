import type { StatusAction, TicketStatusColor, TicketStatusOption } from "@/features/ticket-list/types";

export interface DraftStatus {
  id: string;
  name: string;
  color: TicketStatusColor;
  sortOrder: number;
  isDefault: boolean;
  actions: StatusAction[];
  isNew?: boolean;
}

interface UpdateStatusInput {
  statusId: string;
  name?: string;
  color?: TicketStatusColor;
  sort_order?: number;
  can_create?: boolean;
  can_drag_in?: boolean;
  can_drag_out?: boolean;
  column_actions?: string[];
}

interface SaveStatusesInput {
  original: TicketStatusOption[];
  drafts: DraftStatus[];
  deletedIds: Set<string>;
  newDefaultId: string | null;
  createStatus: (input: { name: string; color: TicketStatusColor }) => Promise<unknown>;
  updateStatus: (input: UpdateStatusInput) => Promise<unknown>;
  setDefaultStatus: (statusId: string) => Promise<unknown>;
  deleteStatus: (statusId: string) => Promise<unknown>;
}

const actionsToPayload = (actions: StatusAction[]) => ({
  can_create: actions.includes("create_ticket"),
  can_drag_in: actions.includes("drag_in"),
  can_drag_out: actions.includes("drag_out"),
  column_actions: actions.includes("archive_all") ? ["archive_all"] : [],
});

const buildStatusChanges = (draft: DraftStatus, original: TicketStatusOption): UpdateStatusInput | null => {
  const update: UpdateStatusInput = { statusId: draft.id };
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

  const draftPayload = actionsToPayload(draft.actions);
  const originalPayload = actionsToPayload(original.actions);

  if (
    draftPayload.can_create !== originalPayload.can_create ||
    draftPayload.can_drag_in !== originalPayload.can_drag_in ||
    draftPayload.can_drag_out !== originalPayload.can_drag_out ||
    JSON.stringify(draftPayload.column_actions) !== JSON.stringify(originalPayload.column_actions)
  ) {
    Object.assign(update, draftPayload);
    changed = true;
  }

  return changed ? update : null;
};

export const saveStatuses = async (input: SaveStatusesInput) => {
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

    const changes = buildStatusChanges(draft, orig);
    if (changes) await input.updateStatus(changes);
  }

  if (newDefaultId) {
    await input.setDefaultStatus(newDefaultId);
  }
};

export const toDraftStatuses = (statuses: TicketStatusOption[]): DraftStatus[] =>
  [...statuses]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((s) => ({
      id: s.id,
      name: s.name,
      color: s.color,
      sortOrder: s.sortOrder,
      isDefault: s.isDefault,
      actions: [...s.actions],
    }));

export const hasStatusChanges = (
  original: TicketStatusOption[],
  drafts: DraftStatus[],
  deletedIds: Set<string>,
  newDefaultId: string | null,
) => {
  if (deletedIds.size > 0 || newDefaultId !== null) return true;

  return drafts.some((draft) => {
    if (draft.isNew) return true;
    const orig = original.find((s) => s.id === draft.id);
    if (!orig) return true;
    return buildStatusChanges(draft, orig) !== null;
  });
};
