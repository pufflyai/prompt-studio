import type { Param, ParamValue, SelectionOption } from "@pstdio/ui";
import type { CommandParamEntry, CommandParamValue } from "./command-palette-params";

const asText = (value: CommandParamValue) => (typeof value === "string" ? value : "");

const asList = (value: CommandParamValue) => (Array.isArray(value) ? value : []);

/** Required params carry the marker in their name — the editor has no required state. */
export const commandParamName = (entry: CommandParamEntry) => `${entry.label}${entry.required ? " *" : ""}`;

const commandParamOptions = (entry: CommandParamEntry): SelectionOption[] =>
  (entry.options ?? []).map((option) => ({ id: option.value, name: option.label, icon: option.icon }));

// Structured params (harness, repo, template) are normally rendered by the host,
// which knows how to fetch their options. Without a host renderer they fall back
// to the JSON they are serialized as, so the command can still be run.
const JSON_PARAM_TYPES = new Set(["json", "resource", "repo", "harness"]);

/**
 * Maps a declared command param onto the design-system control that owns that
 * kind of input, so a command dialog is built from the same rows as every other
 * param surface rather than from hand-rolled fields.
 */
export const buildCommandParam = (entry: CommandParamEntry, value: CommandParamValue): Param => {
  const base = { id: entry.key, name: commandParamName(entry), description: entry.description };

  if (entry.type === "boolean") return { ...base, type: "boolean", defaultValue: value === true };

  if (entry.type === "number") return { ...base, type: "number", defaultValue: Number(asText(value)) };

  if (entry.type === "markdown") return { ...base, type: "markdown", defaultValue: asText(value) };

  if (entry.type === "multi-select") {
    return {
      ...base,
      type: "selection",
      defaultValue: asList(value),
      options: commandParamOptions(entry),
      multiSelect: true,
      placeholder: `Select ${entry.label.toLowerCase()}`,
      searchable: (entry.options?.length ?? 0) > 5,
    };
  }

  if ((entry.type === "select" || entry.type === "template") && entry.options?.length) {
    return {
      ...base,
      type: "selection",
      defaultValue: asText(value),
      options: commandParamOptions(entry),
      placeholder: `Select ${entry.label.toLowerCase()}`,
      searchable: entry.options.length > 5,
      clearable: !entry.required,
    };
  }

  if (entry.type === "longtext" || JSON_PARAM_TYPES.has(entry.type)) {
    return { ...base, type: "text", defaultValue: asText(value), singleLine: false };
  }

  return { ...base, type: "text", defaultValue: asText(value), singleLine: true };
};

/** Narrows an editor value back to what a command param can carry. */
export const readCommandParamValue = (value: ParamValue): CommandParamValue => {
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.map(String);
  return String(value ?? "");
};
