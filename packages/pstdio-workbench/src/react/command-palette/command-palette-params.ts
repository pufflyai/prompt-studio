import type { FileUploadValue } from "@pstdio/ui";
import type { CommandParamDescriptor, CommandParamSchema, WorkbenchCommandExecutionContext } from "../../core";

export interface CommandFilesParamValue {
  refs: string[];
  uploads: FileUploadValue[];
}

export type CommandParamValue = string | boolean | string[] | CommandFilesParamValue | undefined;

export interface CommandParamEntry extends CommandParamDescriptor {
  key: string;
  label: string;
}

const humanize = (value: string) => {
  const spaced = value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[-_]+/g, " ")
    .trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const isFileUploadValue = (value: unknown): value is FileUploadValue => {
  if (!isRecord(value) || !isRecord(value.file)) return false;
  return typeof value.id === "string" && typeof value.file.name === "string" && typeof value.status === "string";
};

export const isCommandFilesParamValue = (value: unknown): value is CommandFilesParamValue =>
  isRecord(value) &&
  Array.isArray(value.refs) &&
  value.refs.every((ref) => typeof ref === "string") &&
  Array.isArray(value.uploads) &&
  value.uploads.every(isFileUploadValue);

export const createCommandFilesParamValue = (input: Partial<CommandFilesParamValue> = {}): CommandFilesParamValue => ({
  refs: [...(input.refs ?? [])],
  uploads: [...(input.uploads ?? [])],
});

const commandFilesParamValue = (raw: unknown, multiple: boolean | undefined) => {
  const value = isCommandFilesParamValue(raw)
    ? createCommandFilesParamValue(raw)
    : createCommandFilesParamValue({
        refs: Array.isArray(raw) ? raw.filter((item): item is string => typeof item === "string") : [],
        uploads: Array.isArray(raw) ? raw.filter(isFileUploadValue) : [],
      });

  if (multiple !== false) return value;
  if (value.uploads[0]) return createCommandFilesParamValue({ uploads: [value.uploads[0]] });
  return createCommandFilesParamValue({ refs: value.refs.slice(0, 1) });
};

const stringifyEditableValue = (value: unknown) => {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
};

const toIdentifierPrefix = (value: string) =>
  value
    .replace(/[^a-zA-Z0-9]+([a-zA-Z0-9])/g, (_match, char: string) => char.toUpperCase())
    .replace(/^[A-Z]/, (char) => char.toLowerCase());

const metadataString = (metadata: Record<string, unknown> | undefined, key: string) => {
  const value = metadata?.[key];
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return undefined;
};

const resourceContextValue = (entry: CommandParamEntry, context: WorkbenchCommandExecutionContext | undefined) => {
  const resource = context?.resource;
  if (!resource) return undefined;

  const metadataValue = metadataString(resource.metadata, entry.key);
  if (metadataValue !== undefined) return metadataValue;

  if (entry.key === `${toIdentifierPrefix(resource.kind)}Id`) return resource.id ?? resource.uri;
  if (entry.type === "resource" && (!entry.resourceType || entry.resourceType === resource.kind)) return resource;
  return undefined;
};

const dedupeOptions = (options: CommandParamDescriptor["options"]) => {
  if (!options) return options;
  const seen = new Set<string>();
  return options.filter((option) => {
    if (seen.has(option.value)) return false;
    seen.add(option.value);
    return true;
  });
};

export const hasCommandParameters = (params: CommandParamSchema | undefined) =>
  listCommandParamEntries(params).length > 0;

export const listCommandParamEntries = (params: CommandParamSchema | undefined): CommandParamEntry[] =>
  Object.entries(params ?? {}).flatMap(([key, param]) =>
    param.resolvedFrom === "resource"
      ? []
      : [
          {
            ...param,
            options: dedupeOptions(param.options),
            key,
            label: param.label ?? humanize(key),
          },
        ],
  );

export const buildCommandParamInitialValues = (
  params: CommandParamSchema | undefined,
  baseArgs?: unknown,
  context?: WorkbenchCommandExecutionContext,
): Record<string, CommandParamValue> => {
  const base = isRecord(baseArgs) ? baseArgs : {};
  const values: Record<string, CommandParamValue> = {};

  for (const entry of listCommandParamEntries(params)) {
    const raw = Object.hasOwn(base, entry.key)
      ? base[entry.key]
      : (resourceContextValue(entry, context) ?? entry.defaultValue);
    if (entry.type === "boolean") {
      values[entry.key] = raw === undefined ? undefined : raw === true || raw === "true";
      continue;
    }
    if (entry.type === "files") {
      values[entry.key] = commandFilesParamValue(raw, entry.multiple);
      continue;
    }
    if (entry.type === "multi-select") {
      values[entry.key] = Array.isArray(raw) ? raw.map(String) : [];
      continue;
    }
    values[entry.key] = stringifyEditableValue(raw);
  }

  return values;
};

const isEmptyValue = (value: CommandParamValue) => {
  if (isCommandFilesParamValue(value)) return value.refs.length === 0 && value.uploads.length === 0;
  return value === undefined || value === "" || (Array.isArray(value) && value.length === 0);
};

const parseJsonValue = (entry: CommandParamEntry, value: CommandParamValue) => {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    throw new Error(`Invalid JSON for ${entry.label}`);
  }
};

const normalizeValue = (entry: CommandParamEntry, value: CommandParamValue) => {
  if (entry.type === "number") {
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue)) throw new Error(`Invalid number for ${entry.label}`);
    return numberValue;
  }
  if (entry.type === "boolean") return value === true || value === "true";
  if (entry.type === "files") return isCommandFilesParamValue(value) ? value : createCommandFilesParamValue();
  if (entry.type === "json" || entry.type === "resource" || entry.type === "repo" || entry.type === "harness") {
    return parseJsonValue(entry, value);
  }
  if (entry.type === "multi-select") return Array.isArray(value) ? value : String(value).split(",").filter(Boolean);
  return String(value ?? "");
};

export const normalizeCommandParamValues = (
  params: CommandParamSchema | undefined,
  values: Record<string, CommandParamValue>,
) => {
  const normalized: Record<string, unknown> = {};

  for (const entry of listCommandParamEntries(params)) {
    const value = values[entry.key];
    if (isEmptyValue(value)) {
      if (entry.required) throw new Error(`Missing required parameter: ${entry.label}`);
      continue;
    }
    normalized[entry.key] = normalizeValue(entry, value);
  }

  return normalized;
};

export const mergeCommandParamArgs = (baseArgs: unknown, params: Record<string, unknown>) => ({
  ...(isRecord(baseArgs) ? baseArgs : {}),
  ...params,
});
