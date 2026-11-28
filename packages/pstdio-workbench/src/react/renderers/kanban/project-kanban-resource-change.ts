import type { CollectionPage, ResourceRef, ViewFilterGroup } from "@pstdio/sdk/extensions";
import { filterRowsByView, withTitleField } from "@pstdio/ui/collection-view";
import type { KanbanRendererRow } from "../../../core";
import { resourceOperationSubject } from "../../../core/registries/mutations/operations";
import type { ResourceChange, ResourcePreviewChanges } from "../../../core/registries/resources/resource-preview";
import type { ReactAttributeDescriptor } from "./kanban-presentation";

interface BoardSnapshot {
  rows: KanbanRendererRow[];
  attributes?: ReactAttributeDescriptor[];
  page?: CollectionPage;
}

const hasValue = (row: KanbanRendererRow, field: string, value: unknown) => {
  const attribute = row.attributes[field] ?? null;
  return Array.isArray(attribute) ? attribute.includes(value) : attribute === value;
};

const subtractRow = (page: CollectionPage | undefined, row: KanbanRendererRow) => {
  if (!page) return page;
  return {
    ...page,
    total: Math.max(0, page.total - 1),
    filteredTotal: Math.max(0, page.filteredTotal - 1),
    groups: page.groups.map((group) => {
      const { parent } = group;
      return hasValue(row, group.field, group.value) && (!parent || hasValue(row, parent.field, parent.value))
        ? { ...group, count: Math.max(0, group.count - 1) }
        : group;
    }),
  };
};

const archiveRow = (row: KanbanRendererRow, attributeId: string, value: string) => {
  const resource = row.resource as ResourceRef | undefined;
  return {
    ...row,
    resource: resource && { ...resource, metadata: { ...resource.metadata, archived: true } },
    attributes: { ...row.attributes, [attributeId]: value },
  };
};

export const projectKanbanResourceChange = <T extends BoardSnapshot>(
  snapshot: T,
  resource: ResourceRef,
  change: ResourceChange,
  filter: ViewFilterGroup,
) => {
  if (!("removed" in change || "archived" in change)) return snapshot;
  const subject = resourceOperationSubject(resource);
  const row = snapshot.rows.find(({ resource: candidate }) => {
    const ref = candidate as ResourceRef | undefined;
    return ref && resourceOperationSubject(ref) === subject;
  });
  if (!row) return snapshot;

  if ("archived" in change) {
    if (row.attributes[change.attributeId] === change.value) return snapshot;
    const archived = archiveRow(row, change.attributeId, change.value);
    if (filterRowsByView([archived], filter, withTitleField(snapshot.attributes ?? [])).length)
      return { ...snapshot, rows: snapshot.rows.map((item) => (item === row ? archived : item)) };
  }
  return { ...snapshot, rows: snapshot.rows.filter((item) => item !== row), page: subtractRow(snapshot.page, row) };
};

export const projectKanbanColumnArchive = <T extends BoardSnapshot>(
  snapshot: T,
  columnId: string,
  filter: ViewFilterGroup,
) => {
  const fields = withTitleField(snapshot.attributes ?? []);
  let page = snapshot.page;
  let changed = false;
  const rows = snapshot.rows.flatMap((row) => {
    if (row.attributes.status !== columnId || row.attributes.archived === "archived") return [row];
    changed = true;
    const archived = archiveRow(row, "archived", "archived");
    if (filterRowsByView([archived], filter, fields).length) return [archived];
    page = subtractRow(page, row);
    return [];
  });
  const hidesEveryArchivedTicket =
    filter.conjunction === "and" &&
    filter.rules.some(
      ({ attributeId, condition, value }) =>
        attributeId === "archived" &&
        condition === "is-any-of" &&
        Array.isArray(value) &&
        value.length > 0 &&
        !value.includes("archived"),
    );
  if (page && hidesEveryArchivedTicket) {
    const inColumn = (group: CollectionPage["groups"][number]) =>
      (group.field === "status" && group.value === columnId) ||
      (group.parent?.field === "status" && group.parent.value === columnId);
    const unloaded = page.groups.find((group) => !group.parent && inColumn(group))?.count ?? 0;
    if (unloaded) {
      changed = true;
      page = {
        ...page,
        total: Math.max(0, page.total - unloaded),
        filteredTotal: Math.max(0, page.filteredTotal - unloaded),
        groups: page.groups.map((group) => (inColumn(group) ? { ...group, count: 0 } : group)),
      };
    }
  }
  return changed ? { ...snapshot, rows, page } : snapshot;
};

export const projectKanbanResourceChanges = <T extends BoardSnapshot>(
  snapshot: T | undefined,
  changes: ResourcePreviewChanges,
  filter: ViewFilterGroup,
) => {
  if (!snapshot) return snapshot;
  let projected = snapshot;
  for (const { resource, change } of changes.values())
    projected = projectKanbanResourceChange(projected, resource, change, filter);
  return projected;
};

export const applyColumnArchives = <T extends BoardSnapshot>(
  snapshot: T | undefined,
  rows: KanbanRendererRow[],
  columns: string[],
  filter: ViewFilterGroup,
) => {
  if (!snapshot || !columns.length) return snapshot;
  return columns.reduce((current, column) => projectKanbanColumnArchive(current, column, filter), {
    ...snapshot,
    rows,
  });
};
