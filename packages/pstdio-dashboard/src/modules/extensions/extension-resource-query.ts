import type { ResourceRef } from "@pstdio/workbench";
import { toWorkbenchResource } from "./extension-kanban-renderers";

const rowsFromQueryValue = (value: unknown) => {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];
  const rows = (value as { rows?: unknown }).rows;
  return Array.isArray(rows) ? rows : [];
};

export const resourceFromQueryValue = (
  value: unknown,
  resourceId: string,
  projectId: string,
): ResourceRef | undefined => {
  const row = rowsFromQueryValue(value).find((candidate) => {
    if (!candidate || typeof candidate !== "object") return false;
    const record = candidate as { id?: unknown; resource?: { id?: unknown } };
    return record.id === resourceId || record.resource?.id === resourceId;
  }) as { resource?: unknown } | undefined;
  return toWorkbenchResource(row?.resource, projectId);
};
