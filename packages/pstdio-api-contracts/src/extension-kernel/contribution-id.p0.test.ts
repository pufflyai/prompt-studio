import { describe, expect, test } from "bun:test";
import { isValidLocalContributionId } from "./contribution-id";

describe("local contribution id grammar", () => {
  test.each([
    "ticket",
    "ticket-editor",
    "ticket-status.create",
    "internal.glyph.add",
    "v2.list",
    "a.b.c",
  ])("accepts %s", (id) => {
    expect(isValidLocalContributionId(id)).toBe(true);
  });

  test.each([
    "ticketStatus.create",
    "ticket_status.create",
    "ticket..create",
    ".ticket",
    "ticket.",
    "-ticket",
    "ticket-",
    "Ticket",
    "",
    "ticket status",
  ])("rejects %s", (id) => {
    expect(isValidLocalContributionId(id)).toBe(false);
  });
});
