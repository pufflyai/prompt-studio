import { describe, expect, test } from "bun:test";
import { formatDataTableRelativeDate } from "./data-table-date-cell";

describe("data table date cells", () => {
  const now = new Date("2026-09-27T12:00:00.000Z");

  test("formats timestamps relative to now", () => {
    expect(formatDataTableRelativeDate("2026-09-27T11:59:30.000Z", now, "en")).toBe("now");
    expect(formatDataTableRelativeDate("2026-09-27T10:00:00.000Z", now, "en")).toBe("2 hours ago");
    expect(formatDataTableRelativeDate("2026-09-24T12:00:00.000Z", now, "en")).toBe("3 days ago");
    expect(formatDataTableRelativeDate("2026-06-27T12:00:00.000Z", now, "en")).toBe("3 months ago");
  });

  test("leaves values that are not dates unformatted", () => {
    expect(formatDataTableRelativeDate("not a date", now, "en")).toBeNull();
    expect(formatDataTableRelativeDate(42, now, "en")).toBeNull();
  });
});
