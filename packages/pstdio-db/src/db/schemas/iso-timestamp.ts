import { customType } from "drizzle-orm/pg-core";

// Normalize PostgreSQL's space-separated form before Date parsing: otherwise
// JavaScript interprets SQL years 0001–0099 as years in the 1900s or 2000s.
export const timestampToIso = (value: string) => {
  let strict = value.replace(" ", "T").replace(/([+-]\d{2})$/, "$1:00");
  // Historical IANA zones can include offset seconds, which Date cannot parse.
  const seconds = /([+-])\d{2}:\d{2}:(\d{2})$/.exec(strict);
  const offsetSeconds = seconds ? Number(seconds[2]) * (seconds[1] === "+" ? 1 : -1) : 0;
  if (seconds) strict = strict.slice(0, -3);
  const fraction = (/\.(\d+)/.exec(value)?.[1] ?? "").replace(/0+$/, "").padEnd(3, "0");
  return new Date(Date.parse(strict) - offsetSeconds * 1000).toISOString().replace(/\.\d{3}Z$/, `.${fraction}Z`);
};

// Pad fractions before comparing canonical UTC strings; `.123Z` is earlier
// than `.123001Z`, despite their unpadded lexical order.
export const timestampSortKey = (value: string) =>
  timestampToIso(value).replace(/(\.\d+)Z$/, (_, fraction: string) => fraction.padEnd(7, "0"));

// Public timestamps remain strings, retaining PostgreSQL's microsecond precision.
export const isoTimestamp = customType<{ data: string; driverData: string }>({
  dataType: () => "timestamp with time zone",
  fromDriver: timestampToIso,
});
