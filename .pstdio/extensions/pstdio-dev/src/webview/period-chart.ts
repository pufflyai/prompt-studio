import { scaleBand } from "@tanstack/charts/scales/band";
import type { Aggregation } from "./period";

const tickDate = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
const fullDate = new Intl.DateTimeFormat(undefined, { dateStyle: "long", timeZone: "UTC" });
const tickMonth = new Intl.DateTimeFormat(undefined, { month: "short", year: "numeric", timeZone: "UTC" });
const tickHour = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});
const fullHour = new Intl.DateTimeFormat(undefined, { dateStyle: "long", timeStyle: "short", timeZone: "UTC" });
const tickFormat = (aggregation: Aggregation) => {
  if (aggregation === "month") return tickMonth;
  return aggregation === "hour" ? tickHour : tickDate;
};

export const periodChartMargin = { left: 72, right: 40 };

export const timelineScale = (buckets: readonly { date: string }[], aggregation: Aggregation) => ({
  scale: scaleBand<string>()
    .domain(buckets.map(({ date }) => date))
    .padding(0.2),
  axis: {
    ticks: { format: (date: string) => tickFormat(aggregation).format(new Date(date)) },
    tickLabels: { thin: { priority: "ends" as const } },
  },
});

export const periodTitle = (date: string, aggregation: Aggregation) => {
  if (aggregation === "month") return tickMonth.format(new Date(date));
  if (aggregation === "hour") return fullHour.format(new Date(date));
  return `${aggregation === "week" ? "Week of " : ""}${fullDate.format(new Date(date))}`;
};
