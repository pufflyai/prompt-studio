import type { DataTableRendererChartOptions } from "@pstdio/sdk/extensions";
import { readDataTableChartValue } from "pstdio-api-contracts/collections";

const number = new Intl.NumberFormat(undefined, { maximumSignificantDigits: 6 });
export const formatDataTableChartValue = (value: number, unit?: string) =>
  `${number.format(value)}${unit ? ` ${unit}` : ""}`;

export const dataTableChartText = (
  value: unknown,
  renderer: DataTableRendererChartOptions,
  activeIndex?: number | null,
) => {
  const data = readDataTableChartValue(value);
  if (!data?.values.some((point) => point !== null)) return ["No data"];
  const descriptions = data.values.map(
    (point, index) =>
      `${data.labels?.[index] ?? index + 1}: ${point === null ? "not measured" : formatDataTableChartValue(point, renderer.unit)}`,
  );
  const active = descriptions[activeIndex ?? -1];
  return active === undefined ? descriptions : [active];
};
