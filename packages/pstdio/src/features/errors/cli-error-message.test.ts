import { describe, expect, test } from "bun:test";
import { formatCliErrorMessage } from "./cli-error-message";

describe("formatCliErrorMessage", () => {
  test("shows the actionable cause for extension command failures", () => {
    expect(
      formatCliErrorMessage(
        new Error(
          'Extension command "pstdio.planner.pullTickets" from "pstdio.planner" failed: Local file already exists: .pstdio/tickets/PS-1/ticket.md. Use --force to overwrite.',
        ),
      ),
    ).toBe("Local file already exists: .pstdio/tickets/PS-1/ticket.md. Use --force to overwrite.");
  });
});
