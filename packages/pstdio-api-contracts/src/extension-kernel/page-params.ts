import type { PageParamDefinition, PageParams, PageParamValue } from "./types/pages";

export type PageParamDefinitions = Readonly<Record<string, PageParamDefinition>>;

// Existing host selectors keep their meaning. Future host keys must start with `_`.
const reserved = new Set(["resource", "section", "document", "line", "column", "endLine", "endColumn"]);
const invalid = (name: string) => new Error(`page_param_invalid: ${name}`);
const equal = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);

export const isPageParamValue = (definition: PageParamDefinition, value: unknown): value is PageParamValue => {
  if (definition.type === "string[]") return Array.isArray(value) && value.every((item) => typeof item === "string");
  if (definition.type === "string")
    return typeof value === "string" && (!definition.values || definition.values.includes(value));
  if (definition.type === "number") return typeof value === "number" && Number.isFinite(value);
  return typeof value === "boolean";
};

export const validatePageParamDefinitions = (definitions: PageParamDefinitions = {}) => {
  if (Object.keys(definitions).length > 32) throw invalid("at most 32 params");
  for (const [name, definition] of Object.entries(definitions)) {
    if (name.length > 64 || !/^[a-z][a-z0-9-]*$/.test(name) || reserved.has(name))
      throw new Error(`page_param_reserved: ${name}`);
    if (definition.default !== undefined && !isPageParamValue(definition, definition.default)) throw invalid(name);
  }
};

const validateNames = (definitions: PageParamDefinitions, values: Readonly<Record<string, unknown>>) => {
  for (const name of Object.keys(values)) if (!Object.hasOwn(definitions, name)) throw invalid(name);
};

export const normalizePageParams = (
  definitions: PageParamDefinitions = {},
  values: Readonly<Record<string, unknown>> = {},
  strict = true,
) => {
  const result: Record<string, PageParamValue> = {};
  if (strict) validateNames(definitions, values);
  for (const name of Object.keys(definitions)) {
    if (!Object.hasOwn(values, name)) continue;
    const value = values[name];
    const definition = definitions[name]!;
    if (!isPageParamValue(definition, value)) {
      if (strict) throw invalid(name);
      continue;
    }
    if (equal(value, definition.default) || (Array.isArray(value) && !value.length)) continue;
    result[name] = Array.isArray(value) ? Object.freeze([...value]) : value;
  }
  const params = Object.keys(result).length ? Object.freeze(result) : undefined;
  if (pageParamsQuery(definitions, params).toString().length > 2048) {
    if (strict) throw invalid("query exceeds 2048 characters");
    return undefined;
  }
  return params;
};

export const resolvePageParams = (definitions: PageParamDefinitions = {}, params?: PageParams) => {
  const result: Record<string, PageParamValue> = {};
  for (const [name, definition] of Object.entries(definitions)) {
    if (definition.default !== undefined)
      result[name] = Array.isArray(definition.default) ? Object.freeze([...definition.default]) : definition.default;
  }
  return Object.freeze({ ...result, ...params });
};

export const pageParamsQuery = (definitions: PageParamDefinitions = {}, params?: PageParams) => {
  const query = new URLSearchParams();
  for (const name of Object.keys(definitions)) {
    const value = params?.[name];
    if (value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) query.append(name, String(item));
  }
  return query;
};

export const parsePageParams = (definitions: PageParamDefinitions = {}, query: URLSearchParams) => {
  const values: Record<string, unknown> = {};
  for (const [name, definition] of Object.entries(definitions)) {
    const items = query.getAll(name);
    if (!items.length || (definition.type !== "string[]" && items.length !== 1)) continue;
    const raw = items[0]!;
    if (definition.type === "string[]") values[name] = items;
    else if (definition.type === "number") {
      if (String(Number(raw)) === raw) values[name] = Number(raw);
    } else if (definition.type === "boolean") {
      if (raw === "true" || raw === "false") values[name] = raw === "true";
    } else values[name] = raw;
  }
  const params = normalizePageParams(definitions, values, false);
  return pageParamsQuery(definitions, params).toString().length <= 2048 ? params : undefined;
};
