import { describe, expect, test } from "bun:test";
import type { HostCommandEvent } from "../hooks/host-context";
import { shouldRefreshTagsForCommand } from "./tag-query-events";

const commandEvent = (commandId: string, outcome: HostCommandEvent["outcome"] = { ok: true, status: "success" }) =>
  ({
    commandId,
    extensionId: "pstdio.pstdio-planner",
    outcome,
    tick: 1,
  }) satisfies HostCommandEvent;

describe("tag query command events", () => {
  test("refreshes tag queries after successful tag definition mutations", () => {
    for (const commandId of [
      "pstdio-planner.ticketTag.create",
      "pstdio-planner.ticketTag.update",
      "pstdio-planner.ticketTag.delete",
      "pstdio-planner.ticketTag.createOption",
      "pstdio-planner.ticketTag.updateOption",
      "pstdio-planner.ticketTag.deleteOption",
    ]) {
      expect(shouldRefreshTagsForCommand(commandEvent(commandId))).toBe(true);
    }
  });

  test("ignores reads, ticket assignments, and failed tag commands", () => {
    expect(shouldRefreshTagsForCommand(commandEvent("pstdio-planner.ticketTag.read"))).toBe(false);
    expect(shouldRefreshTagsForCommand(commandEvent("pstdio-planner.set-ticket-tags"))).toBe(false);
    expect(
      shouldRefreshTagsForCommand(
        commandEvent("pstdio-planner.ticketTag.updateOption", { ok: false, status: "error" }),
      ),
    ).toBe(false);
    expect(shouldRefreshTagsForCommand(null)).toBe(false);
  });
});
