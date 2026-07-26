import type { WorkbenchExtensionDataRendererRecord } from "@pstdio/sdk/api";
import type { DataRendererBoardColumnConfig as WireBoardColumnConfig } from "@pstdio/sdk/extensions";
import type {
  AttributeDescriptor,
  DataRendererContribution,
  DataRendererCreateField,
  DataRendererCreateFieldType,
  ResourceRef,
} from "../../core";
import type { WorkbenchExtensionCommandContext } from "../host/workbench-extension-command";
import {
  createExtensionSlot,
  executeWorkbenchExtensionCommand,
  toWorkbenchResource,
} from "../host/workbench-extension-command";

export type DataRendererRow = Awaited<ReturnType<DataRendererContribution["executeQuery"]>>[number];
export type RowAction = NonNullable<WorkbenchExtensionDataRendererRecord["rowActions"]>[number];
export type QueryResult = {
  attributes?: WorkbenchExtensionDataRendererRecord["attributes"];
  boardColumnConfigs?: Record<string, WireBoardColumnConfig>;
  rows?: unknown[];
};
export type Localizer = (value: unknown, fallback?: string) => string;

export interface MutableAttributeSource {
  source: DataRendererContribution["attributes"];
  set(attributes: WorkbenchExtensionDataRendererRecord["attributes"] | undefined): void;
}

export const isQueryResult = (value: unknown): value is QueryResult =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const localizeAttributes = (
  record: WorkbenchExtensionDataRendererRecord,
  attributes: WorkbenchExtensionDataRendererRecord["attributes"] | undefined,
  localize: Localizer,
  decorate: (record: WorkbenchExtensionDataRendererRecord, attribute: AttributeDescriptor) => AttributeDescriptor,
): AttributeDescriptor[] =>
  (attributes ?? []).map((attribute) => {
    const base: AttributeDescriptor = {
      ...attribute,
      label: localize(attribute.label, attribute.id),
      type:
        attribute.type.kind === "enum" || attribute.type.kind === "enum-multi"
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
  record: WorkbenchExtensionDataRendererRecord,
  initial: WorkbenchExtensionDataRendererRecord["attributes"] | undefined,
  localize: Localizer,
  decorate: (record: WorkbenchExtensionDataRendererRecord, attribute: AttributeDescriptor) => AttributeDescriptor,
): MutableAttributeSource => {
  let snapshot = localizeAttributes(record, initial, localize, decorate);
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
      snapshot = localizeAttributes(record, attributes, localize, decorate);
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

export const defaultResolveRowResource = (_: WorkbenchExtensionDataRendererRecord, row: DataRendererRow) => {
  const { resource } = row;
  if (isWorkbenchResource(resource)) return resource;
  if (isExtensionResource(resource)) return toWorkbenchResource(resource);
  return undefined;
};

export const defaultResolveRowActionResource = (record: WorkbenchExtensionDataRendererRecord, row: DataRendererRow) => {
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

export const toWorkbenchRow = (row: unknown, resolveResource: (row: DataRendererRow) => ResourceRef | undefined) => {
  const candidate = row as DataRendererRow;
  const resource = resolveResource(candidate);
  return resource === undefined ? candidate : ({ ...candidate, resource } as DataRendererRow);
};

export const mergeParams = (...items: Array<Record<string, unknown> | undefined>) =>
  Object.assign({}, ...items.filter((item): item is Record<string, unknown> => Boolean(item)));

const asParams = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;

const hasCommandParameters = (params: Record<string, unknown> | undefined) => Object.keys(params ?? {}).length > 0;

const CREATE_FIELD_TYPES: ReadonlySet<string> = new Set<DataRendererCreateFieldType>([
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
  descriptor: NonNullable<NonNullable<WorkbenchExtensionDataRendererRecord["createRow"]>["params"]>[string],
  localize: Localizer,
): DataRendererCreateField => {
  // Dropping an unsupported type renders a form silently missing what the
  // extension declared, so refuse the contribution instead.
  if (!CREATE_FIELD_TYPES.has(descriptor.type))
    throw new Error(
      `Create form cannot render param "${id}" of type "${descriptor.type}". Supported types: ${[...CREATE_FIELD_TYPES].join(", ")}.`,
    );

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
    type: descriptor.type as DataRendererCreateFieldType,
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

export const toCreateFields = (record: WorkbenchExtensionDataRendererRecord, localize: Localizer) =>
  Object.entries(record.createRow?.params ?? {}).map(([id, descriptor]) => toCreateField(id, descriptor, localize));

const createDataRendererSlot = (
  context: WorkbenchExtensionCommandContext,
  record: WorkbenchExtensionDataRendererRecord,
) =>
  createExtensionSlot({
    id: record.id,
    kind: "dataRenderer",
    projectId: context.projectId,
    context: { dataRendererId: record.id },
  });

export const executeDataRendererCommand = (
  context: WorkbenchExtensionCommandContext,
  record: WorkbenchExtensionDataRendererRecord,
  commandId: string,
  params: Record<string, unknown>,
  resource?: ResourceRef,
) =>
  executeWorkbenchExtensionCommand(context, commandId, {
    params,
    resource: resource ?? context.workbench.getPrimaryResource(),
    slot: createDataRendererSlot(context, record),
    metadata: { dataRendererId: record.id },
  });

const dataRendererRowActionCommandId = (record: WorkbenchExtensionDataRendererRecord, action: RowAction) =>
  `workbench.extension.dataRenderer.${record.id}.rowAction.${action.id}`;

export const registerRowActionCommands = (
  context: WorkbenchExtensionCommandContext,
  record: WorkbenchExtensionDataRendererRecord,
  localize: Localizer,
) =>
  (record.rowActions ?? []).map((action) => {
    const target = context.workbench.commands.getCommand(action.commandId)?.command;
    return context.workbench.commands.registerCommand(
      {
        id: dataRendererRowActionCommandId(record, action),
        label: localize(action.label, action.id),
        icon: action.icon,
        params: target?.params,
      },
      {
        execute: (args, executionContext) =>
          executeDataRendererCommand(
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
  record: WorkbenchExtensionDataRendererRecord,
  action: RowAction,
  row: DataRendererRow,
  resource: ResourceRef | undefined,
  localize: Localizer,
) => {
  const commandId = dataRendererRowActionCommandId(record, action);
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

  return executeDataRendererCommand(context, record, action.commandId, args, resource).then(() => undefined);
};
