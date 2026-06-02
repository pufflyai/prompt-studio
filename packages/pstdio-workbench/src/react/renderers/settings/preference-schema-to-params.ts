import type { ParamEditorProps } from "@pstdio/ui";
import type { PreferencePropertySchema, PreferenceValue } from "../../../core";

// `@pstdio/ui` does not export the Param union by name, so derive it from the
// editor props — this keeps the mapper honest about what the editor accepts.
type Param = NonNullable<ParamEditorProps["params"]>[number];
type ParamValue = Parameters<NonNullable<ParamEditorProps["onChange"]>>[1];

export interface PreferenceParamEntry {
  name: string;
  schema: PreferencePropertySchema;
  label?: string;
  /** Current value; falls back to the schema default when omitted. */
  value?: PreferenceValue;
}

// Booleans have no dedicated param-editor control, so they render as a two-option
// selection. Array/object schemas without an enum have no editor at all and are skipped.
const BOOLEAN_OPTIONS = [
  { id: "true", name: "On" },
  { id: "false", name: "Off" },
];

const humanize = (value: string) => {
  const segment = value.split(".").at(-1) ?? value;
  const spaced = segment.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[-_]/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

const toOptions = (values: PreferenceValue[]) =>
  values.map((value) => ({ id: String(value), name: humanize(String(value)) }));

const toParam = (entry: PreferenceParamEntry): Param | undefined => {
  const { name, schema } = entry;
  const label = entry.label ?? humanize(name);
  const description = schema.description;
  const current = entry.value ?? schema.default;
  const base = { id: name, name: label, description };

  if (schema.type === "number") {
    return { ...base, type: "number", defaultValue: Number(current ?? 0) };
  }

  if (schema.type === "boolean") {
    return { ...base, type: "selection", defaultValue: String(Boolean(current)), options: BOOLEAN_OPTIONS };
  }

  if (schema.type === "string") {
    if (schema.enum) {
      return { ...base, type: "selection", defaultValue: String(current ?? ""), options: toOptions(schema.enum) };
    }
    return { ...base, type: "text", defaultValue: String(current ?? ""), singleLine: true };
  }

  if (schema.type === "array" && schema.enum) {
    const defaultValue = Array.isArray(current) ? current.map(String) : [];
    return { ...base, type: "selection", multiSelect: true, defaultValue, options: toOptions(schema.enum) };
  }

  return undefined;
};

export const preferenceSchemaToParams = (entries: PreferenceParamEntry[]) =>
  entries.map(toParam).filter((param): param is Param => param !== undefined);

export const paramValueToPreference = (schema: PreferencePropertySchema, value: ParamValue): PreferenceValue => {
  if (schema.type === "boolean") return value === "true";
  if (schema.type === "number") return Number(value);
  if (schema.type === "array") return Array.isArray(value) ? value.map(String) : [];
  return String(value);
};
