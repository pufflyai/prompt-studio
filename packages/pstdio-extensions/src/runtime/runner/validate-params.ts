import type { ParamDescriptor, ParamObjectSchema } from "@pstdio/sdk/extensions";

export type ValidateParamsResult = { ok: true } | { ok: false; reason: string };

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === "string");

const describeValue = (value: unknown) => {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
};

const checkDescriptor = (key: string, descriptor: ParamDescriptor, value: unknown): string | undefined => {
  switch (descriptor.type) {
    case "text":
    case "longtext":
    case "select":
    case "template":
      if (typeof value !== "string") return `Param "${key}" must be a string (got ${describeValue(value)})`;
      return undefined;
    case "number":
      if (typeof value !== "number" || !Number.isFinite(value))
        return `Param "${key}" must be a finite number (got ${describeValue(value)})`;
      return undefined;
    case "boolean":
      if (typeof value !== "boolean") return `Param "${key}" must be a boolean (got ${describeValue(value)})`;
      return undefined;
    case "multi-select":
    case "list":
      if (!isStringArray(value)) return `Param "${key}" must be a string array (got ${describeValue(value)})`;
      return undefined;
    case "repo":
      if (!isPlainObject(value) || typeof value.repoId !== "string")
        return `Param "${key}" must be a repo reference with a string "repoId"`;
      return undefined;
    case "harness":
      if (!isPlainObject(value) || typeof value.harnessId !== "string")
        return `Param "${key}" must be a harness reference with a string "harnessId"`;
      return undefined;
    case "resource":
      if (!isPlainObject(value) || typeof value.type !== "string" || typeof value.id !== "string")
        return `Param "${key}" must be a resource reference with string "type" and "id"`;
      return undefined;
    case "json":
      return undefined;
    default:
      return undefined;
  }
};

export const validateCommandParams = (schema: ParamObjectSchema, params: unknown): ValidateParamsResult => {
  const entries = Object.entries(schema);
  if (entries.length === 0) return { ok: true };
  if (!isPlainObject(params)) return { ok: false, reason: `Params must be an object (got ${describeValue(params)})` };

  for (const [key, descriptor] of entries) {
    const value = params[key];
    const present = Object.hasOwn(params, key) && value !== undefined;

    if (!present) {
      if (descriptor.required) return { ok: false, reason: `Missing required param "${key}"` };
      continue;
    }

    const error = checkDescriptor(key, descriptor, value);
    if (error) return { ok: false, reason: error };
  }

  return { ok: true };
};
