import type { CommandParamDescriptor, CommandParamSchema } from "../../core";

export type CommandParamValue = string | boolean | string[] | undefined;

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

const stringifyEditableValue = (value: unknown) => {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
};

export const hasCommandParameters = (params: CommandParamSchema | undefined) => Object.keys(params ?? {}).length > 0;

export const listCommandParamEntries = (params: CommandParamSchema | undefined): CommandParamEntry[] =>
  Object.entries(params ?? {}).map(([key, param]) => ({
    ...param,
    key,
    label: param.label ?? humanize(key),
  }));

export const buildCommandParamInitialValues = (
  params: CommandParamSchema | undefined,
  baseArgs?: unknown,
): Record<string, CommandParamValue> => {
  const base = isRecord(baseArgs) ? baseArgs : {};
  const values: Record<string, CommandParamValue> = {};

  for (const entry of listCommandParamEntries(params)) {
    const raw = Object.hasOwn(base, entry.key) ? base[entry.key] : entry.defaultValue;
    if (entry.type === "boolean") {
      values[entry.key] = raw === undefined ? undefined : raw === true || raw === "true";
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

const isEmptyValue = (value: CommandParamValue) =>
  value === undefined || value === "" || (Array.isArray(value) && value.length === 0);

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
