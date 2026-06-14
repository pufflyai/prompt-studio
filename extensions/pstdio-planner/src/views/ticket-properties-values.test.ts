import { describe, expect, test } from "bun:test";
import { formatTicketUpdatedAt, normalizeTicketDependencies } from "./ticket-properties-values";

describe("ticket property values", () => {
  test("normalizes dependency values into displayable ticket ids", () => {
    expect(normalizeTicketDependencies(null)).toEqual([]);
    expect(normalizeTicketDependencies([])).toEqual([]);
    expect(normalizeTicketDependencies(["T-1", "T-2"])).toEqual(["T-1", "T-2"]);
    expect(normalizeTicketDependencies("[]")).toEqual([]);
  });

  test("formats updated timestamps as readable dates", () => {
    const formatted = formatTicketUpdatedAt("2026-06-08T10:05:00.000Z");

    expect(formatted).toContain("2026");
    expect(formatted).not.toMatch(/^\d{1,2}\/\d{1,2}\/\d{2,4}/);
  });
});
