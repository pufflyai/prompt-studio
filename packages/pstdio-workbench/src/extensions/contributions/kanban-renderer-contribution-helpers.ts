import type { KanbanRendererBoardColumnConfig as WireBoardColumnConfig } from "@pstdio/sdk/extensions";
import type { WorkbenchExtensionKanbanRendererRecord } from "pstdio-api-contracts";
import type {
  AttributeDescriptor,
  EnumOptions,
  KanbanRendererContribution,
  KanbanRendererCreateField,
  KanbanRendererCreateFieldType,
  ResourceRef,
} from "../../core";
import type { WorkbenchExtensionCommandContext } from "../host/workbench-extension-command";
import {
  createExtensionSlot,
  executeWorkbenchExtensionCommand,
  toExtensionCommandResource,
  toWorkbenchResource,
} from "../host/workbench-extension-command";

export type KanbanRendererRow = Awaited<ReturnType<KanbanRendererContribution["executeQuery"]>>[number];
export type RowAction = NonNullable<WorkbenchExtensionKanbanRendererRecord["rowActions"]>[number];
export type QueryResult = {
  attributes?: WorkbenchExtensionKanbanRendererRecord["attributes"];
  boardColumnConfigs?: Record<string, WireBoardColumnConfig>;
  rows?: unknown[];
};
export type Localizer = (value: unknown, fallback?: string) => string;

export interface MutableAttributeSource {
  source: KanbanRendererContribution["attributes"];
  set(attributes: WorkbenchExtensionKanbanRendererRecord["attributes"] | undefined): void;
}

export type ResolveStatusOptions = (
  statuses: Extract<
    NonNullable<WorkbenchExtensionKanbanRendererRecord["attributes"]>[number]["type"],
    { kind: "status" }
  >["statuses"],
) => EnumOptions;

export const isQueryResult = (value: unknown): value is QueryResult =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const localizeAttributes = (
  record: WorkbenchExtensionKanbanRendererRecord,
  attributes: WorkbenchExtensionKanbanRendererRecord["attributes"] | undefined,
  localize: Localizer,
  decorate: (record: WorkbenchExtensionKanbanRendererRecord, attribute: AttributeDescriptor) => AttributeDescriptor,
  resolveStatusOptions: ResolveStatusOptions,
): AttributeDescriptor[] =>
  (attributes ?? []).map((attribute) => {
    const base: AttributeDescriptor = {
      ...attribute,
      label: localize(attribute.label, attribute.id),
      type:
        attribute.type.kind === "status"
          ? { kind: "enum", options: resolveStatusOptions(attribute.type.statuses) }
          : attribute.type.kind === "enum" || attribute.type.kind === "enum-multi"
            ? {
                ...attribute.type,
                options: Array.isArray(attribute.type.options)
                  ? attribute.type.options.map((option) => ({ ...option, label: localize(option.label, option.value) }))
                  : attribute.type.options,
              }
            : attribute.type,
    };
    return decorate(record, base);
  });

export const createMutableAttributeSource = (
  record: WorkbenchExtensionKanbanRendererRecord,
  initial: WorkbenchExtensionKanbanRendererRecord["attributes"] | undefined,
  localize: Localizer,
  decorate: (record: WorkbenchExtensionKanbanRendererRecord, attribute: AttributeDescriptor) => AttributeDescriptor,
  resolveStatusOptions: ResolveStatusOptions = () => [],
): MutableAttributeSource => {
  let snapshot = localizeAttributes(record, initial, localize, decorate, resolveStatusOptions);
  const listeners = new Set<() => void>();
  return {
    source: {
      getSnapshot: () => snapshot,
      subscribe: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    },
    set(attributes) {
      snapshot = localizeAttributes(record, attributes, localize, decorate, resolveStatusOptions);
      for (const listener of listeners) listener();
    },
  };
};

const isWorkbenchResource = (resource: unknown): resource is ResourceRef =>
  Boolean(resource && typeof resource === "object" && typeof (resource as { kind?: unknown }).kind === "string");

const isExtensionResource = (resource: unknown): resource is Parameters<typeof toWorkbenchResource>[0] =>
  Boolean(
    resource &&
      typeof resource === "object" &&
      typeof (resource as { type?: unknown }).type === "string" &&
      typeof (resource as { id?: unknown }).id === "string",
  );

const rowResourceUri = (kind: string, id: string) =>
  `pstdio://extension-resource/${encodeURIComponent(kind)}/${encodeURIComponent(id)}`;

export const defaultResolveRowResource = (_: WorkbenchExtensionKanbanRendererRecord, row: KanbanRendererRow) => {
  const { resource } = row;
  if (isWorkbenchResource(resource)) return resource;
  if (isExtensionResource(resource)) return toWorkbenchResource(resource);
  return undefined;
};

export const defaultResolveRowActionResource = (
  record: WorkbenchExtensionKanbanRendererRecord,
  row: KanbanRendererRow,
) => {
  const fromRow = defaultResolveRowResource(record, row);
  if (fromRow) return fromRow;
  if (!record.resourceKind) return undefined;
  return {
    kind: record.resourceKind,
    uri: rowResourceUri(record.resourceKind, row.id),
    id: row.id,
    label: row.title,
  };
};

export const toWorkbenchRow = (row: unknown, resolveResource: (row: KanbanRendererRow) => ResourceRef | undefined) => {
  const candidate = row as KanbanRendererRow;
  const resource = resolveResource(candidate);
  return resource === undefined ? candidate : ({ ...candidate, resource } as KanbanRendererRow);
};

export const mergeParams = (...items: Array<Record<string, unknown> | undefined>) =>
  Object.assign({}, ...items.filter((item): item is Record<string, unknown> => Boolean(item)));

const asParams = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;

const hasCommandParameters = (params: Record<string, unknown> | undefined) => Object.keys(params ?? {}).length > 0;

const CREATE_FIELD_TYPES: ReadonlySet<string> = new Set<KanbanRendererCreateFieldType>([
  "text",
  "longtext",
  "markdown",
  "number",
  "boolean",
  "select",
  "multi-select",
  "files",
]);

const toCreateField = (
  id: string,
  descriptor: NonNullable<NonNullable<WorkbenchExtensionKanbanRendererRecord["createRow"]>["params"]>[string],
  localize: Localizer,
): KanbanRendererCreateField | undefined => {
  if (!CREATE_FIELD_TYPES.has(descriptor.type)) return undefined;

  const options =
    "options" in descriptor && Array.isArray(descriptor.options)
      ? (descriptor.options as Array<{ value: string; label: string; icon?: string }>)
      : [];
  const optional = descriptor as { placeholder?: unknown; multiple?: unknown; accept?: unknown };

  return {
    id,
    label: localize(descriptor.label, id),
    description: descriptor.description === undefined ? undefined : localize(descriptor.description),
    placeholder: optional.placeholder === undefined ? undefined : localize(optional.placeholder),
    type: descriptor.type as KanbanRendererCreateFieldType,
    required: descriptor.required === true,
    defaultValue: descriptor.defaultValue,
    options:
      descriptor.type === "select" || descriptor.type === "multi-select"
        ? options.map((option) => ({
            value: option.value,
            label: localize(option.label, option.value),
            icon: option.icon,
          }))
        : undefined,
    multiple: descriptor.type === "files" ? optional.multiple !== false : undefined,
    accept: descriptor.type === "files" && typeof optional.accept === "string" ? optional.accept : undefined,
  };
};

export const toCreateFields = (record: WorkbenchExtensionKanbanRendererRecord, localize: Localizer) =>
  Object.entries(record.createRow?.params ?? {}).flatMap(([id, descriptor]) => {
    const field = toCreateField(id, descriptor, localize);
    return field ? [field] : [];
  });

const createKanbanRendererSlot = (
  context: WorkbenchExtensionCommandContext,
  record: WorkbenchExtensionKanbanRendererRecord,
) =>
  createExtensionSlot({
    id: record.id,
    kind: "kanbanRenderer",
    projectId: context.projectId,
    context: { kanbanRendererId: record.id },
  });

export const executeKanbanRendererCommand = (
  context: WorkbenchExtensionCommandContext,
  record: WorkbenchExtensionKanbanRendererRecord,
  commandId: string,
  params: Record<string, unknown>,
  resource?: ResourceRef,
) => {
  const commandResource = resource ?? context.workbench.getPrimaryResource();
  return executeWorkbenchExtensionCommand(context, commandId, {
    params: {
      renderer: {
        rendererId: record.id,
        projectId: context.projectId,
        ...(commandResource ? { resource: toExtensionCommandResource(commandResource) } : {}),
        invocation: { placement: "visible" },
      },
      ...params,
    },
    resource: commandResource,
    slot: createKanbanRendererSlot(context, record),
    metadata: { kanbanRendererId: record.id },
  });
};

const kanbanRendererRowActionCommandId = (record: WorkbenchExtensionKanbanRendererRecord, action: RowAction) =>
  `workbench.extension.kanbanRenderer.${record.id}.rowAction.${action.id}`;

export const registerRowActionCommands = (
  context: WorkbenchExtensionCommandContext,
  record: WorkbenchExtensionKanbanRendererRecord,
  localize: Localizer,
) =>
  (record.rowActions ?? []).map((action) => {
    const target = context.workbench.commands.getCommand(action.commandId)?.command;
    return context.workbench.commands.registerCommand(
      {
        id: kanbanRendererRowActionCommandId(record, action),
        label: localize(action.label, action.id),
        icon: action.icon,
        params: target?.params,
      },
      {
        execute: (args, executionContext) =>
          executeKanbanRendererCommand(
            context,
            record,
            action.commandId,
            mergeParams(asParams(args)),
            executionContext?.resource,
          ),
      },
    );
  });

export const runDefaultRowAction = (
  context: WorkbenchExtensionCommandContext,
  record: WorkbenchExtensionKanbanRendererRecord,
  action: RowAction,
  row: KanbanRendererRow,
  resource: ResourceRef | undefined,
  localize: Localizer,
) => {
  const commandId = kanbanRendererRowActionCommandId(record, action);
  const command = context.workbench.commands.getCommand(commandId);
  const args = { rowId: row.id };
  const executionContext = resource ? { resource } : undefined;
  const label = localize(action.label, action.id);

  if (command && hasCommandParameters(command.command.params)) {
    context.workbench.commandPalette.requestParams({ record: command, label, args, context: executionContext });
    return Promise.resolve();
  }

  if (command)
    return context.workbench.commands.executeCommand(command.command.id, args, executionContext).then(() => undefined);

  return executeKanbanRendererCommand(context, record, action.commandId, args, resource).then(() => undefined);
};
