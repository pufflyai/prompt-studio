import { describe, expect, test } from "bun:test";

describe("resolveTicketByShorthand", () => {
  test("module exports resolveTicketByShorthand function", async () => {
    const mod = await import("./resolve-ticket-by-shorthand");
    expect(typeof mod.resolveTicketByShorthand).toBe("function");
  });
});
