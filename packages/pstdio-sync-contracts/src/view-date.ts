export interface ViewDateFormat {
  locale: string;
  timeZone: string;
  part: "day" | "text" | "timestamp";
}

const calendars = new Map<string, Intl.DateTimeFormat>();
const texts = new Map<string, Intl.DateTimeFormat>();
const formatter = (options: ViewDateFormat, calendar: boolean) => {
  const cache = calendar ? calendars : texts;
  const key = JSON.stringify(calendar ? options.timeZone : [options.locale, options.timeZone]);
  let value = cache.get(key);
  if (!value) {
    value = calendar
      ? new Intl.DateTimeFormat("en-US-u-ca-gregory-nu-latn", {
          timeZone: options.timeZone,
          year: "numeric",
          month: "numeric",
          day: "numeric",
          era: "short",
          hour: "numeric",
          minute: "numeric",
          second: "numeric",
          hourCycle: "h23",
        })
      : new Intl.DateTimeFormat(options.locale, { timeZone: options.timeZone });
    if (cache.size >= 128) cache.delete(cache.keys().next().value!);
    cache.set(key, value);
  }
  return value;
};
const utc = (year: number, month: number, day: number, hour = 0, minute = 0, second = 0) => {
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(hour, minute, second, 0);
  return date.getTime();
};
const calendarParts = (instant: number, options: ViewDateFormat) => {
  const parts = Object.fromEntries(
    formatter(options, true)
      .formatToParts(instant)
      .map(({ type, value }) => [type, value]),
  );
  const year = parts.era === "BC" ? 1 - Number(parts.year) : Number(parts.year);
  return {
    year,
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
};
const localClock = (instant: number, options: ViewDateFormat) => {
  const parts = calendarParts(instant, options);
  return utc(parts.year, parts.month, parts.day, parts.hour, parts.minute, parts.second);
};

// Like the browser's local Date constructor: earlier instant for a fold, forward through a gap.
const zonedMidnight = (naive: number, options: ViewDateFormat) => {
  const day = 86_400_000;
  const offsets = new Set(
    [-2, 0, 2].map((days) => {
      const probe = naive + days * day;
      return localClock(probe, options) - probe;
    }),
  );
  const candidates = [...offsets].map((offset) => naive - offset);
  const exact = candidates.filter((candidate) => localClock(candidate, options) === naive);
  if (exact.length) return Math.min(...exact);
  return Math.min(...candidates.filter((candidate) => localClock(candidate, options) > naive));
};

export const formatViewDate = (value: unknown, options: ViewDateFormat) => {
  if ((typeof value !== "string" && typeof value !== "number") || value === "") return undefined;
  let instant: number;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    // Numeric Date constructors treat 00–99 as 1900–1999 and roll invalid days.
    instant = zonedMidnight(Date.UTC(year, month - 1, day), options);
  } else instant = new Date(value).getTime();
  if (!Number.isFinite(instant)) return options.part === "text" ? String(value) : undefined;
  if (options.part === "timestamp") return instant;
  if (options.part === "text") return formatter(options, false).format(instant);
  const { year, month, day } = calendarParts(instant, options);
  return year * 10000 + month * 100 + day;
};

export const validateViewDateFormat = (format: ViewDateFormat) => {
  if (
    !format ||
    !["day", "text", "timestamp"].includes(format.part) ||
    typeof format.locale !== "string" ||
    !format.locale ||
    typeof format.timeZone !== "string" ||
    !format.timeZone
  )
    throw new Error("Date formatting needs a part, viewer locale and time zone");
  formatter(format, true);
  formatter(format, false);
};
