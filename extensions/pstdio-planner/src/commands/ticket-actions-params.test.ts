import { describe, expect, test } from "bun:test";
import { implementTicketCommand } from "./implement-ticket";
import { breakIntoSubTicketsCommand, refineTicketCommand, runAttemptCommand } from "./ticket-actions";

describe("ticket action command params", () => {
  test("labels harness selectors as model selectors", () => {
    expect(runAttemptCommand.params?.agent?.label).toBe("Model");
    expect(refineTicketCommand.params?.agent?.label).toBe("Model");
    expect(breakIntoSubTicketsCommand.params?.agent?.label).toBe("Model");
    expect(implementTicketCommand.params?.agent?.label).toBe("Model");
  });
});
