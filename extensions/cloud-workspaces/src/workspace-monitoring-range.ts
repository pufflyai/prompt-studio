import { defaultHistoryRange, historyRanges } from "./workspace-history-range";

export const monitoringRange = (value: unknown) =>
  historyRanges.find(({ value: range }) => range === value)?.value ?? defaultHistoryRange;

const hours = { hour: 1, day: 24, week: 168 };
export const monitoringWindow = (value: unknown, to = Date.now()) => ({
  from: to - 3_600_000 * hours[monitoringRange(value)],
  to,
});

export const monitoringRangeParam = {
  type: "string",
  values: historyRanges.map(({ value }) => value),
  default: defaultHistoryRange,
} as const;
