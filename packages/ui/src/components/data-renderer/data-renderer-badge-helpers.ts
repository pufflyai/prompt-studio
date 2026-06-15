import { enumOptionLabel, findEnumOption, getEnumOptions, toTitleCase } from "./data-renderer-enum-helpers";
import type { AttributeDescriptor, AttributeType, EnumOption } from "./types";

const summarizeMultiEnum = (values: string[], type: AttributeType) => {
  if (values.length === 0) return null;
  if (values.length <= 2) return values.map((value) => enumOptionLabel(type, value)).join(", ");
  return `${enumOptionLabel(type, values[0]!)}, ${enumOptionLabel(type, values[1]!)} +${values.length - 2}`;
};

export interface AttributeBadge {
  attributeId: string;
  attributeLabel?: string;
  label: string;
  color?: string;
  icon?: string | null;
  value?: string | string[];
  options?: EnumOption[];
  isEditable?: boolean;
}

export const getAttributeBadgeColorPalette = (_badge: AttributeBadge) => "gray";

export const renderEnumBadge = (descriptor: AttributeDescriptor, type: AttributeType, value: unknown) => {
  if (type.kind !== "enum") return null;
  const stringValue = typeof value === "string" ? value : null;
  const editable = descriptor.editable === true;
  if (!stringValue) {
    return editable
      ? {
          attributeId: descriptor.id,
          attributeLabel: descriptor.label,
          label: descriptor.label,
          value: stringValue ?? undefined,
          options: getEnumOptions(type),
          isEditable: true,
        }
      : null;
  }
  const option = findEnumOption(type, stringValue);
  return {
    attributeId: descriptor.id,
    attributeLabel: descriptor.label,
    label: option?.label ?? toTitleCase(stringValue),
    color: option?.color,
    icon: option?.icon,
    ...(editable ? { value: stringValue, options: getEnumOptions(type), isEditable: true } : {}),
  };
};

export const renderMultiEnumBadge = (descriptor: AttributeDescriptor, type: AttributeType, value: unknown) => {
  if (type.kind !== "enum-multi") return null;
  const values = Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
  const summary = summarizeMultiEnum(values, type);
  const editable = descriptor.editable === true;
  if (!summary) {
    return editable
      ? {
          attributeId: descriptor.id,
          attributeLabel: descriptor.label,
          label: descriptor.label,
          value: values,
          options: getEnumOptions(type),
          isEditable: true,
        }
      : null;
  }
  const firstOption = values[0] ? findEnumOption(type, values[0]) : undefined;
  return {
    attributeId: descriptor.id,
    attributeLabel: descriptor.label,
    label: summary,
    color: firstOption?.color,
    icon: firstOption?.icon,
    ...(editable ? { value: values, options: getEnumOptions(type), isEditable: true } : {}),
  };
};
