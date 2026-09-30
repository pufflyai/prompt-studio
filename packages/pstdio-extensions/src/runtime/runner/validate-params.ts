import type { ParamDescriptor, ParamObjectSchema, WorkspaceParam } from "@pstdio/sdk/extensions";

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

const checkWorkspace = (key: string, descriptor: WorkspaceParam, value: unknown) => {
  if (!isPlainObject(value) || typeof value.providerId !== "string")
    return `Param "${key}" must be a workspace choice with a string "providerId"`;
  if (value.params !== undefined && !isPlainObject(value.params))
    return `Param "${key}" workspace params must be an object`;
  if (descriptor.providers && !descriptor.providers.includes(value.providerId))
    return `Param "${key}" must use one of these workspace providers: ${descriptor.providers.join(", ")}`;
  return undefined;
};

const checkDescriptor = (key: string, descriptor: ParamDescriptor, value: unknown): string | undefined => {
  switch (descriptor.type) {
    case "text":
    case "longtext":
    case "markdown":
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
    case "files":
      if (!isStringArray(value)) return `Param "${key}" must be a string array (got ${describeValue(value)})`;
      return undefined;
    case "harness":
      if (!isPlainObject(value) || typeof value.harnessId !== "string")
        return `Param "${key}" must be a harness reference with a string "harnessId"`;
      return undefined;
    case "resource":
      if (!isPlainObject(value) || typeof value.type !== "string" || typeof value.id !== "string")
        return `Param "${key}" must be a resource reference with string "type" and "id"`;
      return undefined;
    case "workspace":
      return checkWorkspace(key, descriptor, value);
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

const validateDeclaredChoice = (key: string, descriptor: ParamDescriptor, value: unknown) => {
  if (value === undefined || (descriptor.type !== "select" && descriptor.type !== "multi-select")) return;
  const options = descriptor.options;
  if (!Array.isArray(options)) throw new Error(`Param "${key}" requires fixed options for a workspace provider`);
  if (descriptor.allowCustomValues) return;
  const values = Array.isArray(value) ? value : [value];
  if (values.some((entry) => !options.some((option) => option.value === entry))) {
    throw new Error(`Param "${key}" must use these options: ${options.map((option) => option.value).join(", ")}`);
  }
};

export const resolveDeclaredParams = (schema: ParamObjectSchema, input: Record<string, unknown>) => {
  const unknown = Object.keys(input).filter((key) => !Object.hasOwn(schema, key));
  if (unknown.length) throw new Error(`Unknown params: ${unknown.join(", ")}`);
  const params = { ...input };
  for (const [key, descriptor] of Object.entries(schema)) {
    if (params[key] === undefined && descriptor.defaultValue !== undefined) params[key] = descriptor.defaultValue;
  }
  const result = validateCommandParams(schema, params);
  if (!result.ok) throw new Error(result.reason);
  for (const [key, descriptor] of Object.entries(schema)) {
    validateDeclaredChoice(key, descriptor, params[key]);
  }
  return params;
};
