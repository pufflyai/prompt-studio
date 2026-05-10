import { describe, expect, it } from "bun:test";
import type { Ticket } from "@/features/ticket-list/types";
import { buildParentPath } from "./ticket-parent-path";

const makeTicket = (overrides: Partial<Ticket>): Ticket => ({
  id: "t0",
  shorthand: "T-0",
  title: "",
  content: "",
  tagIds: [],
  status: "open",
  updatedAt: "",
  ...overrides,
});

describe("buildParentPath", () => {
  it("returns empty array when ticket has no parent", () => {
    const ticket = makeTicket({ id: "t1", shorthand: "T-1" });
    const result = buildParentPath(ticket, new Map());
    expect(result).toEqual([]);
  });

  it("returns single ancestor shorthand", () => {
    const parent = makeTicket({ id: "p1", shorthand: "P-1" });
    const child = makeTicket({ id: "c1", shorthand: "C-1", parentId: "p1" });

    const map = new Map([["p1", parent]]);
    expect(buildParentPath(child, map)).toEqual(["P-1"]);
  });

  it("returns ancestor shorthand when parentId is a shorthand", () => {
    const parent = makeTicket({ id: "p1", shorthand: "P-1" });
    const child = makeTicket({ id: "c1", shorthand: "C-1", parentId: "P-1" });

    const map = new Map([["p1", parent]]);
    expect(buildParentPath(child, map)).toEqual(["P-1"]);
  });

  it("returns ancestors in root-first order", () => {
    const grandparent = makeTicket({ id: "gp", shorthand: "GP-1" });
    const parent = makeTicket({ id: "p1", shorthand: "P-1", parentId: "gp" });
    const child = makeTicket({ id: "c1", shorthand: "C-1", parentId: "p1" });

    const map = new Map([
      ["gp", grandparent],
      ["p1", parent],
    ]);
    expect(buildParentPath(child, map)).toEqual(["GP-1", "P-1"]);
  });

  it("stops when parent is not in map", () => {
    const child = makeTicket({ id: "c1", shorthand: "C-1", parentId: "missing" });
    expect(buildParentPath(child, new Map())).toEqual([]);
  });

  it("handles cycle without infinite loop", () => {
    const a = makeTicket({ id: "a", shorthand: "A", parentId: "b" });
    const b = makeTicket({ id: "b", shorthand: "B", parentId: "a" });

    const map = new Map([
      ["a", a],
      ["b", b],
    ]);

    const result = buildParentPath(a, map);
    // Should terminate and not contain duplicates
    expect(result.length).toBeLessThanOrEqual(2);
  });

  it("handles self-referencing parentId", () => {
    const ticket = makeTicket({ id: "s", shorthand: "S", parentId: "s" });
    const map = new Map([["s", ticket]]);

    const result = buildParentPath(ticket, map);
    expect(result.length).toBeLessThanOrEqual(1);
  });
});
