import { describe, expect, test } from "bun:test";
import { runAttemptCommand } from "./run-attempt";
import { breakIntoSubTicketsCommand, refineTicketCommand } from "./ticket-actions";

describe("ticket action command params", () => {
  test("limits Run attempt to user-editable inputs", () => {
    expect(Object.keys(runAttemptCommand.params ?? {})).toEqual([
      "ticket",
      "rowId",
      "agent",
      "newVariant",
      "workspace",
    ]);
  });

  test("lets Run attempt choose a Git worktree and its base branch", () => {
    expect(runAttemptCommand.params?.workspace).toMatchObject({ type: "workspace", providers: ["pstdio.worktree"] });
  });

  test("declares ticket templates as template selectors", () => {
    expect(refineTicketCommand.params?.template).toMatchObject({
      type: "template",
      templateType: "ticket",
    });
    expect(breakIntoSubTicketsCommand.params?.template).toMatchObject({
      type: "template",
      templateType: "ticket",
    });
  });
});
