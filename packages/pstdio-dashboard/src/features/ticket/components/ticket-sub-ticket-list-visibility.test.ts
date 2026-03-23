import { describe, expect, it } from "bun:test";
import { hasVisibleSubTickets } from "./ticket-sub-ticket-list-visibility";

describe("hasVisibleSubTickets", () => {
  it("returns false when sub-ticket list is empty", () => {
    expect(hasVisibleSubTickets([])).toBe(false);
    expect(hasVisibleSubTickets(undefined)).toBe(false);
  });

  it("returns true when at least one sub-ticket exists", () => {
    expect(hasVisibleSubTickets([{ id: "sub-1", shorthand: "PS-2", title: "Sub ticket one" }])).toBe(true);
  });
});
