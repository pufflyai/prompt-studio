import { describe, expect, it } from "bun:test";

import { getTicketListIndentation } from "./ticket-list";

describe("getTicketListIndentation", () => {
  it("does not indent top-level rows", () => {
    expect(getTicketListIndentation(0)).toBeUndefined();
  });

  it("uses compact depth indentation", () => {
    expect(getTicketListIndentation(1)).toBe("12px");
    expect(getTicketListIndentation(2)).toBe("24px");
  });
});
