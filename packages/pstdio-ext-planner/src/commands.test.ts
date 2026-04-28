import { describe, expect, test } from "bun:test";
import { plannerCommands } from "./commands";

describe("plannerCommands", () => {
  test("keeps --id as a pull alias for the ticket shorthand", () => {
    expect(plannerCommands.pullTickets.cli?.options).toMatchObject({
      id: { type: "string" },
      ticket_id: { type: "string" },
    });
  });
});
