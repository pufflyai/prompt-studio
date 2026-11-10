import type { DataTableRendererChartOptions } from "@pstdio/sdk/extensions";
import { readDataTableChartValue } from "pstdio-api-contracts/collections";

const number = new Intl.NumberFormat(undefined, { maximumSignificantDigits: 6 });
export const formatDataTableChartValue = (value: number, unit?: string) =>
  `${number.format(value)}${unit ? ` ${unit}` : ""}`;

export const dataTableChartText = (value: unknown, renderer: DataTableRendererChartOptions) => {
  const data = readDataTableChartValue(value);
  if (!data?.values.some((point) => point !== null)) return ["No data"];
  return data.values.map(
    (point, index) =>
      `${data.labels?.[index] ?? index + 1}: ${point === null ? "not measured" : formatDataTableChartValue(point, renderer.unit)}`,
  );
};
