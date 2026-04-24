export const normalizeToolName = (value: string) => {
  return value
    .replace(/^tool-/i, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[\s-]+/g, "_")
    .toLowerCase();
};

export const getToolNameLookupKeys = (value: string) => {
  const normalized = normalizeToolName(value);
  const compact = normalized.replace(/_/g, "");
  return [...new Set([value, normalized, compact])];
};
