import { expect, test } from "bun:test";
import { formatViewDate } from "./view-date";

test("date projections retain viewer calendar, localized text, date-only rollover and DST semantics", () => {
  const timeZone = "America/New_York",
    locale = "en-US";
  const date = "2026-11-14T01:00:00Z";
  expect(formatViewDate(date, { timeZone, locale, part: "day" })).toBe(20261113);
  expect(formatViewDate(date, { timeZone, locale, part: "text" })).toBe("11/13/2026");
  expect(formatViewDate("2026-02-30", { timeZone, locale, part: "day" })).toBe(20260302);
  expect(formatViewDate("0099-01-01", { timeZone, locale, part: "day" })).toBe(19990101);
  expect(formatViewDate("2026-03-08", { timeZone, locale, part: "timestamp" })).toBe(
    Date.parse("2026-03-08T05:00:00Z"),
  );
  expect(formatViewDate("2011-12-30", { timeZone: "Pacific/Apia", locale, part: "day" })).toBe(20111231);
  expect(formatViewDate(date, { timeZone: "Asia/Tokyo", locale: "ar-EG-u-ca-islamic", part: "text" })).toBe(
    new Date(date).toLocaleDateString("ar-EG-u-ca-islamic", { timeZone: "Asia/Tokyo" }),
  );
  expect(formatViewDate("invalid", { timeZone, locale, part: "day" })).toBeUndefined();
});
