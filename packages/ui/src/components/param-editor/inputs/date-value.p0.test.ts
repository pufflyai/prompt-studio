import { describe, expect, test } from "bun:test";
import { formatReadOnlyDate } from "./date-value";

describe("formatReadOnlyDate", () => {
  test("keeps a calendar date on the same day in every time zone", () => {
    const expected = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(2026, 9, 5));

    expect(formatReadOnlyDate("2026-10-05")).toBe(expected);
  });

  test("shows a value that is not a date as written", () => {
    expect(formatReadOnlyDate("someday")).toBe("someday");
  });
});
