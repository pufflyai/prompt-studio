import { isDisplayValue } from "./helpers";
import type { RowData } from "./types";

export interface HistogramBin {
  start: number;
  end: number;
  count: number;
}

export interface HistogramStat {
  min: number;
  max: number;
  bins: HistogramBin[];
}

export interface TopValueStat {
  label: string;
  count: number;
  percentage: number;
}

const getStatValue = (value: unknown) => (isDisplayValue(value) ? value.sortValue : value);

const getColumnStatValues = (rows: RowData[], columnId: string) =>
  rows
    .map((row) => getStatValue(row[columnId]))
    .filter((value) => value !== null && value !== undefined && value !== "");

export const countUniqueStatValues = (rows: RowData[], columnId: string) =>
  new Set(getColumnStatValues(rows, columnId)).size;

export const buildTopValuesStat = (rows: RowData[], columnId: string, limit: number) => {
  const values = getColumnStatValues(rows, columnId);
  const counts = new Map<unknown, number>();

  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  const groups: TopValueStat[] = [...counts.entries()]
    .map(([value, count]) => ({
      label: String(value),
      count,
      percentage: Math.round((count / values.length) * 100),
    }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
  const topGroups = groups.slice(0, limit);
  const otherCount = groups.slice(limit).reduce((total, group) => total + group.count, 0);

  if (otherCount === 0) return topGroups;

  return [
    ...topGroups,
    {
      label: "Other",
      count: otherCount,
      percentage: Math.round((otherCount / values.length) * 100),
    },
  ];
};

export const buildHistogramStat = (rows: RowData[], columnId: string, binCount: number): HistogramStat | null => {
  const values = getColumnStatValues(rows, columnId).filter((value): value is number => typeof value === "number");
  if (values.length === 0) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const binWidth = (max - min) / binCount;
  const bins = Array.from({ length: binCount }, (_, index) => ({
    start: min + binWidth * index,
    end: min + binWidth * (index + 1),
    count: 0,
  }));

  for (const value of values) {
    const binIndex = value === max || binWidth === 0 ? binCount - 1 : Math.floor((value - min) / binWidth);
    bins[binIndex]!.count += 1;
  }

  return { min, max, bins };
};
