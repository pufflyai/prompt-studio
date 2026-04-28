import type { SyncedRow } from "@/features/sync/collections";
import type { ApiWorkspaceArtifact } from "@/features/ticket-list/data/api/types";
import type { TicketFilePreview, TicketStatusColor } from "@/features/ticket-list/types";

export const PLANNER_EXTENSION_ID = "pstdio.planner";

type ResourceRef = {
  type?: string;
  id?: string;
  label?: string;
  extensionId?: string;
};

const asRecord = (value: unknown) =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const asString = (value: unknown, fallback = "") => (typeof value === "string" ? value : fallback);
const asBoolean = (value: unknown, fallback = false) => (typeof value === "boolean" ? value : fallback);
const asNumber = (value: unknown, fallback: number) => (typeof value === "number" ? value : fallback);

const isPlannerTicketRef = (ref: ResourceRef) =>
  ref.type === "pstdio.planner.ticket" || (ref.type === "ticket" && ref.extensionId === PLANNER_EXTENSION_ID);

export const plannerCollectionRows = (
  rows: SyncedRow[] | undefined,
  collection: string,
  projectId: string | undefined,
) =>
  (rows ?? []).filter(
    (row) =>
      row.extension_id === PLANNER_EXTENSION_ID &&
      row.collection === collection &&
      (!projectId || row.project_id === projectId),
  );

export const toPlannerTicketRows = (items: SyncedRow[]) =>
  items.map((item) => {
    const value = asRecord(item.value_json);
    const id = asString(value.id, asString(item.item_id, item.id));

    return {
      id,
      project_id: asString(value.projectId, asString(item.project_id)),
      shorthand: asString(value.shorthand, id),
      created_at: asString(value.createdAt, asString(item.created_at)),
      updated_at: asString(value.updatedAt, asString(item.updated_at)),
      display_title: (value.displayTitle as string | null | undefined) ?? null,
      status_id: (value.statusId as string | null | undefined) ?? null,
      blocked_reason: (value.blockedReason as string | null | undefined) ?? null,
      depends_on: (value.dependsOn as string | null | undefined) ?? null,
      parent_id: (value.parentId as string | null | undefined) ?? null,
      archived: asBoolean(value.archived),
      draft: asBoolean(value.draft),
      deleted_at: null,
      tag_names: Array.isArray(value.tagNames) ? value.tagNames : [],
      value_json: value,
    } satisfies SyncedRow;
  });

export const toPlannerStatusRows = (items: SyncedRow[]) =>
  items.map((item, index) => {
    const value = asRecord(item.value_json);
    const id = asString(value.id, asString(item.item_id, item.id));

    return {
      id,
      project_id: asString(item.project_id),
      name: asString(value.name, id),
      color: asString(value.color, "gray") as TicketStatusColor,
      sort_order: asNumber(value.sortOrder ?? value.sort_order, index + 1),
      is_default: asBoolean(value.isDefault ?? value.is_default, index === 0),
      can_drag_out: asBoolean(value.canDragOut ?? value.can_drag_out, true),
      can_drag_in: asBoolean(value.canDragIn ?? value.can_drag_in, true),
      can_create: asBoolean(value.canCreate ?? value.can_create, index === 0),
      column_actions: Array.isArray(value.columnActions ?? value.column_actions)
        ? (value.columnActions ?? value.column_actions)
        : [],
    } satisfies SyncedRow;
  });

export const toPlannerTagRows = (tagItems: SyncedRow[], optionItems: SyncedRow[]) => {
  const optionRows = optionItems.map((item, index) => {
    const value = asRecord(item.value_json);
    const id = asString(value.id, asString(item.item_id, item.id));
    return {
      id,
      tag_id: asString(value.tagId ?? value.tag_id, "planner-tags"),
      name: asString(value.name, id),
      color: asString(value.color, "gray"),
      sort_order: asNumber(value.sortOrder ?? value.sort_order, index + 1),
      icon: (value.icon as string | null | undefined) ?? null,
      description: (value.description as string | null | undefined) ?? null,
    };
  });

  const tagRows = tagItems.map((item) => {
    const value = asRecord(item.value_json);
    const id = asString(value.id, asString(item.item_id, item.id));
    return {
      id,
      name: asString(value.name, id),
      type: asString(value.type, "multi_select"),
      options: optionRows.filter((option) => option.tag_id === id),
    } satisfies SyncedRow;
  });

  if (tagRows.length > 0 || optionRows.length === 0) return tagRows;
  return [{ id: "planner-tags", name: "Tags", type: "multi_select", options: optionRows } satisfies SyncedRow];
};

export const buildPlannerTagIdsByTicket = (ticketRows: SyncedRow[]) => {
  const tagIdsByTicket = new Map<string, string[]>();

  for (const ticket of ticketRows) {
    if (Array.isArray(ticket.tag_names)) {
      tagIdsByTicket.set(
        ticket.id,
        ticket.tag_names.filter((tagName): tagName is string => typeof tagName === "string"),
      );
    }
  }

  return tagIdsByTicket;
};

export const buildWorkspacesByPlannerTicket = (rawWorkspaces: SyncedRow[] | undefined) => {
  const workspacesByTicket = new Map<string, SyncedRow[]>();

  for (const workspace of rawWorkspaces ?? []) {
    const anchors = Array.isArray(workspace.anchors_json) ? (workspace.anchors_json as ResourceRef[]) : [];
    for (const anchor of anchors.filter(isPlannerTicketRef)) {
      for (const key of [anchor.id, anchor.label].filter((value): value is string => typeof value === "string")) {
        const existing = workspacesByTicket.get(key) ?? [];
        existing.push(workspace);
        workspacesByTicket.set(key, existing);
      }
    }
  }

  return workspacesByTicket;
};

const sizeFromBase64 = (contentBase64: string) => {
  const normalized = contentBase64.trim();
  if (!normalized) return 0;
  const padding = normalized.endsWith("==") ? 2 : normalized.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((normalized.length * 3) / 4) - padding);
};

export const toPlannerTicketFiles = (ticketItem: SyncedRow | undefined) => {
  const ticket = asRecord(ticketItem?.value_json);
  const storedFiles = Array.isArray(ticket.files) ? ticket.files.map(asRecord) : [];

  const files: TicketFilePreview[] = [];
  const artifacts: ApiWorkspaceArtifact[] = [];

  for (const file of storedFiles) {
    const id = asString(file.id);
    const fileName = asString(file.fileName, id);
    const contentBase64 = asString(file.contentBase64);
    const base = {
      id,
      file_name: fileName,
      file_kind: asString(file.fileKind, "attachment"),
      mime_type: (file.mimeType as string | null | undefined) ?? null,
      size_bytes: sizeFromBase64(contentBase64),
      created_at: asString(ticketItem?.created_at),
    };

    const relativePath = file.relativePath;
    if (typeof relativePath === "string") {
      artifacts.push({
        ...base,
        file_id: id,
        relative_path: relativePath,
        updated_at: asString(ticketItem?.updated_at),
      });
    } else {
      files.push(base);
    }
  }

  return { files, artifacts: artifacts.sort((a, b) => a.relative_path.localeCompare(b.relative_path)) };
};
