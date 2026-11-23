import type { ControlValueMap, KanbanRendererMove, ResourceRef } from "@pstdio/sdk/extensions";
import { applyKanbanMove } from "@pstdio/ui/kanban-renderer";
import { controlValueSchema } from "pstdio-api-contracts";
import type { DataTableRendererRow, KanbanRendererRow } from "../../core";
import { classifyApiWrite } from "../../core/registries/mutations/operation-failures";
import type { OperationPreview } from "../../core/registries/mutations/operation-types";
import { operationSubject, resourceOperationSubject } from "../../core/registries/mutations/operations";

interface CollectionRow {
  id: string;
  resource?: unknown;
}

interface CollectionOperationIntent {
  sourceId: string;
  subject: string;
  move: KanbanRendererMove;
}

interface CollectionOperationInput {
  sourceId: string;
  projectId?: string;
  row?: CollectionRow;
  move: KanbanRendererMove;
}

const domain = "collection.row";

const rowResource = (row?: CollectionRow) => {
  const resource = row?.resource as Partial<ResourceRef> | undefined;
  return typeof resource?.id === "string" && typeof resource.type === "string" ? (resource as ResourceRef) : undefined;
};

const collectionSubject = (sourceId: string, projectId: string | undefined, row: CollectionRow) => {
  const resource = rowResource(row);
  if (resource) return resourceOperationSubject({ ...resource, projectId: resource.projectId ?? projectId });
  return operationSubject("collection-row", projectId, sourceId, row.id);
};

export const collectionOperation = (input: CollectionOperationInput) => {
  const { sourceId, projectId, row, move } = input;
  const source = rowResource(row);
  const subject = collectionSubject(sourceId, projectId, row ?? { id: move.rowId });
  return {
    domain,
    projectId: source?.projectId ?? projectId,
    subjects: [subject],
    source,
    title: "Edit collection row",
    draft: move,
    intent: { sourceId, subject, move } satisfies CollectionOperationIntent,
    classify: classifyApiWrite,
  };
};

const asIntent = (operation: OperationPreview) =>
  operation.domain === domain && operation.intent ? (operation.intent as CollectionOperationIntent) : undefined;

const matches = (row: CollectionRow, intent: CollectionOperationIntent, sourceId: string, projectId?: string) =>
  collectionSubject(sourceId, projectId, row) === intent.subject;

const knownValues = (fields: Record<string, unknown>, attributes: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(attributes).filter(([key]) => Object.hasOwn(fields, key)));

export const projectBoardRows = (
  rows: KanbanRendererRow[],
  pending: readonly OperationPreview[],
  sourceId: string,
  projectId?: string,
) =>
  pending.reduce((projected, operation) => {
    const intent = asIntent(operation);
    if (!intent) return projected;
    const row = projected.find((candidate) => matches(candidate, intent, sourceId, projectId));
    if (!row) return projected;
    const sameSource = sourceId === intent.sourceId;
    const anchor = intent.move.order?.beforeRowId;
    const order =
      sameSource && (anchor === undefined || projected.some(({ id }) => id === anchor)) ? intent.move.order : undefined;
    const attributes = sameSource ? intent.move.attributes : knownValues(row.attributes, intent.move.attributes);
    return applyKanbanMove(projected, { rowId: row.id, attributes, order });
  }, rows);

export const projectTableRows = (
  rows: DataTableRendererRow[],
  pending: readonly OperationPreview[],
  projectId?: string,
) =>
  pending.reduce((projected, operation) => {
    const intent = asIntent(operation);
    if (!intent) return projected;
    const row = projected.find((candidate) => rowResource(candidate) && matches(candidate, intent, "", projectId));
    if (!row) return projected;
    const values = knownValues(row.values, intent.move.attributes);
    if (Object.keys(values).length === 0) return projected;
    return projected.map((candidate) =>
      candidate === row ? { ...row, values: { ...row.values, ...values } } : candidate,
    );
  }, rows);

export const collectionReadMatches = (
  operation: OperationPreview,
  rows: readonly CollectionRow[],
  sourceId: string,
  projectId?: string,
) => {
  const intent = asIntent(operation);
  return Boolean(
    intent &&
      rows.some(
        (row) => (sourceId === intent.sourceId || rowResource(row)) && matches(row, intent, sourceId, projectId),
      ),
  );
};

export const projectControlValues = (
  values: ControlValueMap,
  row: CollectionRow,
  pending: readonly OperationPreview[],
  sourceId: string,
  projectId?: string,
) => {
  const changes: ControlValueMap = {};
  for (const operation of pending) {
    const intent = asIntent(operation);
    if (!intent || !matches(row, intent, sourceId, projectId)) continue;
    for (const [key, value] of Object.entries(knownValues(values, intent.move.attributes))) {
      const parsed = controlValueSchema.safeParse(value);
      if (parsed.success) changes[key] = parsed.data;
    }
  }
  return Object.keys(changes).length ? { ...values, ...changes } : values;
};
