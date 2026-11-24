export const DAY_MS = 86_400_000;
export type Aggregation = "hour" | "day" | "week" | "month";
export const HOUR_MS = 3_600_000;
export type DateRange = "7" | "30" | "90" | "all";

export const rangeOptions: { value: DateRange; label: string }[] = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "all", label: "All time" },
];

export const aggregationOptions: { value: Aggregation; label: string }[] = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
];

export const dateKey = (value: number | Date) => new Date(value).toISOString().slice(0, 10);
export const dayOf = (value: string) => value.slice(0, 10);

/** Hour buckets are UTC keys such as `2026-11-20T09:00Z`; other buckets are dates. */
export const hourKey = (value: number) => `${new Date(value).toISOString().slice(0, 13)}:00Z`;

/** Accepts a date or a full timestamp. */
export const bucketDate = (date: string, aggregation: Aggregation) => {
  if (aggregation === "hour") return date.length > 10 ? hourKey(Date.parse(date)) : `${date}T00:00Z`;
  const day = date.slice(0, 10);
  if (aggregation === "month") return `${day.slice(0, 7)}-01`;
  if (aggregation === "day") return day;
  const start = new Date(day);
  return dateKey(start.getTime() - ((start.getUTCDay() + 6) % 7) * DAY_MS);
};

export const nextBucket = (date: string, aggregation: Aggregation) => {
  if (aggregation === "hour") return hourKey(Date.parse(date) + HOUR_MS);
  const start = new Date(date);
  if (aggregation === "month") return dateKey(start.setUTCMonth(start.getUTCMonth() + 1));
  return dateKey(start.getTime() + (aggregation === "week" ? 7 : 1) * DAY_MS);
};

/** The last bucket of a timeline ending today: the current hour for hourly timelines. */
export const lastBucket = (today: string, aggregation: Aggregation, now = Date.now()) => {
  if (aggregation !== "hour") return bucketDate(today, aggregation);
  return dateKey(now) === today ? hourKey(now) : `${today}T23:00Z`;
};

/** First day of a relative range, or the earliest day available when the range is all time. */
export const rangeStart = (today: string, range: DateRange, earliest: string) =>
  range === "all" ? earliest : dateKey(Date.parse(today) - (Number(range) - 1) * DAY_MS);
