import type { AttributeType, EnumOption } from "./types";
import { isEnumOptionsSource } from "./types";

const dedupeEnumOptions = (options: EnumOption[]) => {
  const seen = new Set<string>();
  return options.filter((option) => {
    if (seen.has(option.value)) return false;
    seen.add(option.value);
    return true;
  });
};

/**
 * Normalize an enum / enum-multi attribute's `options` to a plain option list.
 * Sources resolve via `getSnapshot()` on every call, so callers naturally see
 * the latest values.
 */
export const getEnumOptions = (type: AttributeType) => {
  if (type.kind !== "enum" && type.kind !== "enum-multi") return [];
  const options = isEnumOptionsSource(type.options) ? type.options.getSnapshot() : type.options;
  return dedupeEnumOptions(options);
};

export const toTitleCase = (value: string) =>
  value
    .replaceAll("_", " ")
    .split(" ")
    .filter((chunk) => chunk.length > 0)
    .map((chunk) => chunk[0]!.toUpperCase() + chunk.slice(1))
    .join(" ");

export const findEnumOption = (type: AttributeType, value: string) => {
  if (type.kind !== "enum" && type.kind !== "enum-multi") return undefined;
  return getEnumOptions(type).find((option) => option.value === value);
};

export const enumOptionLabel = (type: AttributeType, value: string) => {
  const option = findEnumOption(type, value);
  return option?.label ?? toTitleCase(value);
};
