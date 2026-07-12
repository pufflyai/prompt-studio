import { ParamEditor } from "@/components/param-editor";

interface JsonField {
  label: string;
  value: unknown;
}

export interface FriendlyJsonDisplayProps {
  value: unknown;
}

const imageExtensionPattern = /\.(avif|bmp|gif|jpe?g|png|svg|webp)$/i;
const imageLabelPattern = /(^|\s)(avatar|image|logo|photo|picture|thumbnail)(\s|$)/i;

const humanizeKey = (key: string) => {
  const words = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .toLowerCase();

  return words ? `${words[0]?.toUpperCase()}${words.slice(1)}` : "Details";
};

const formatPath = (path: string[]) => path.map((part) => (/^\d+$/.test(part) ? part : humanizeKey(part))).join(" / ");

const isPrimitiveArray = (value: unknown[]) => value.every((item) => item === null || typeof item !== "object");

const appendJsonFields = (value: unknown, path: string[], fields: JsonField[]) => {
  if (Array.isArray(value)) {
    if (value.length === 0 || isPrimitiveArray(value)) {
      fields.push({ label: formatPath(path), value });
      return;
    }

    value.forEach((item, index) => {
      appendJsonFields(item, [...path, String(index + 1)], fields);
    });
    return;
  }

  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value);
    if (entries.length === 0) {
      fields.push({ label: formatPath(path), value: null });
      return;
    }

    entries.forEach(([key, item]) => {
      appendJsonFields(item, [...path, key], fields);
    });
    return;
  }

  fields.push({ label: formatPath(path), value });
};

export const parseJsonCellValue = (value: unknown) => {
  if (typeof value !== "string") return value;

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
};

export const buildJsonFields = (value: unknown) => {
  const fields: JsonField[] = [];
  appendJsonFields(parseJsonCellValue(value), [], fields);
  return fields.map((field) => ({ ...field, label: field.label || "Value" }));
};

export const isJsonImageValue = (value: unknown, label: string) => {
  if (typeof value !== "string") return false;
  if (value.startsWith("data:image/")) return true;

  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    return imageExtensionPattern.test(url.pathname) || imageLabelPattern.test(label);
  } catch {
    return false;
  }
};

export const isJsonImageArray = (value: unknown, label: string) => {
  return Array.isArray(value) && value.length > 0 && value.every((item) => isJsonImageValue(item, label));
};

const formatJsonPrimitive = (value: unknown) => {
  if (value === null || value === undefined || value === "") return "Not provided";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
};

const formatJsonValue = (value: unknown) => {
  if (Array.isArray(value)) return value.length === 0 ? "None" : value.map(formatJsonPrimitive).join(", ");
  return formatJsonPrimitive(value);
};

export const getJsonCellSummary = (value: unknown) => {
  const parsedValue = parseJsonCellValue(value);
  if (Array.isArray(parsedValue) && parsedValue.length === 0) return "No details";
  if (parsedValue !== null && typeof parsedValue === "object" && Object.keys(parsedValue).length === 0) {
    return "No details";
  }

  const fields = buildJsonFields(value).filter(
    (field) => !isJsonImageValue(field.value, field.label) && !isJsonImageArray(field.value, field.label),
  );
  if (fields.length === 0) return "No details";

  const visibleValues = fields.slice(0, 2).map((field) => formatJsonValue(field.value));
  const remainingCount = fields.length - visibleValues.length;
  return [...visibleValues, remainingCount > 0 ? `${remainingCount} more` : null].filter(Boolean).join(" · ");
};

const toReadOnlyValue = (field: JsonField) => {
  const { label, value } = field;
  if (isJsonImageValue(value, label)) {
    return { type: "image" as const, src: String(value), alt: `${label} preview` };
  }
  if (Array.isArray(value) && isJsonImageArray(value, label)) {
    return {
      type: "image-gallery" as const,
      images: value.map((image, index) => ({ src: String(image), alt: `${label} ${index + 1} preview` })),
    };
  }
  if (Array.isArray(value)) return value as Array<string | number | boolean | null>;
  if (value === undefined) return null;
  return value as string | number | boolean | null;
};

export const buildFriendlyJsonParams = (value: unknown) =>
  buildJsonFields(value).map((field, index) => ({
    id: `friendly-json-${index}`,
    name: field.label,
    type: "readOnly" as const,
    value: toReadOnlyValue(field),
  }));

export const FriendlyJsonDisplay = (props: FriendlyJsonDisplayProps) => {
  const { value } = props;
  return <ParamEditor params={buildFriendlyJsonParams(value)} readOnly fullWidth />;
};
