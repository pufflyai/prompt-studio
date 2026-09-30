import { getEnumOptions } from "./kanban-renderer-enum-helpers";
import type { AttributeDescriptor } from "./types";

const textValue = (descriptor: AttributeDescriptor, value: unknown) => {
  if (value === null || value === undefined || value === "") return null;
  if (descriptor.type.kind === "enum" || descriptor.type.kind === "enum-multi") {
    const values = Array.isArray(value) ? value : [value];
    const options = getEnumOptions(descriptor.type);
    return (
      values.map((item) => options.find((option) => option.value === item)?.label ?? String(item)).join(", ") || null
    );
  }
  if (descriptor.type.kind === "date" && typeof value === "string") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString();
  }
  if (typeof value === "string" || (typeof value === "number" && Number.isFinite(value))) return String(value);
  return null;
};

const linkValue = (value: unknown) => {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? value : null;
  } catch {
    return null;
  }
};

export const resolveAttributeDisplay = (descriptor: AttributeDescriptor, value: unknown) => {
  if (descriptor.display?.kind === "text") {
    const text = textValue(descriptor, value);
    return text === null ? null : { kind: "text" as const, value: text };
  }
  if (descriptor.display?.kind === "link") {
    const href = linkValue(value);
    return href === null ? null : { kind: "link" as const, value: href };
  }
  return null;
};
