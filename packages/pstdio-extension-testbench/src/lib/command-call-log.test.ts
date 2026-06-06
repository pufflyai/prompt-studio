import { describe, expect, test } from "bun:test";
import { type CommandCallLogEntry, commandLogLimit, recordCommandCallEntry } from "./command-call-log";

const commandCall = (id: string, status: CommandCallLogEntry["status"] = "success") =>
  ({
    commandId: `command.${id}`,
    id,
    request: { projectId: "project:test" },
    status,
  }) satisfies CommandCallLogEntry;

describe("recordCommandCallEntry", () => {
  test("keeps the last 100 command calls", () => {
    const calls = Array.from({ length: commandLogLimit }, (_, index) => commandCall(`existing-${index}`));

    const nextCalls = recordCommandCallEntry(calls, commandCall("latest"));

    expect(nextCalls).toHaveLength(commandLogLimit);
    expect(nextCalls[0]?.id).toBe("latest");
    expect(nextCalls.at(-1)?.id).toBe("existing-98");
  });

  test("updates existing calls without duplicating them", () => {
    const nextCalls = recordCommandCallEntry([commandCall("rename", "pending")], commandCall("rename", "success"));

    expect(nextCalls).toEqual([commandCall("rename", "success")]);
  });
});
