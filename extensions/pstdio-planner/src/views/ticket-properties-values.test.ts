import { describe, expect, test } from "bun:test";
import { normalizeTicketDependencies } from "./ticket-properties-values";

describe("ticket property values", () => {
  test("normalizes dependency values into displayable ticket ids", () => {
    expect(normalizeTicketDependencies(null)).toEqual([]);
    expect(normalizeTicketDependencies([])).toEqual([]);
    expect(normalizeTicketDependencies(["T-1", "T-2"])).toEqual(["T-1", "T-2"]);
    expect(normalizeTicketDependencies("[]")).toEqual([]);
  });
});
