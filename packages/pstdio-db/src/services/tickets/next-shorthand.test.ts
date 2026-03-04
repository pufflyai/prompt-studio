import { describe, expect, test } from "bun:test";
import { nextTicketShorthand } from "./next-shorthand";

describe("nextTicketShorthand", () => {
  test("generates PS-1 for first ticket", () => {
    expect(nextTicketShorthand("PS", 0)).toBe("PS-1");
  });

  test("increments correctly", () => {
    expect(nextTicketShorthand("PS", 41)).toBe("PS-42");
  });

  test("works with single-letter shorthand", () => {
    expect(nextTicketShorthand("B", 0)).toBe("B-1");
  });

  test("works with multi-letter shorthand", () => {
    expect(nextTicketShorthand("CSP", 9)).toBe("CSP-10");
  });
});
