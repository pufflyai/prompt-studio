export const readDataTableChartValue = (value: unknown) => {
  if (!value || typeof value !== "object" || !("values" in value) || !Array.isArray(value.values)) return undefined;
  if (!value.values.every((point) => point === null || (typeof point === "number" && Number.isFinite(point))))
    return undefined;
  const labels =
    "labels" in value && Array.isArray(value.labels) && value.labels.every((label) => typeof label === "string")
      ? value.labels
      : undefined;
  return { values: value.values as (number | null)[], labels };
};
