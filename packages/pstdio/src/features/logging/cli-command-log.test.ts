import { describe, expect, test } from "bun:test";
import { createCliCommandTracker, isMutatingCliCommand, MUTATING_CLI_COMMANDS } from "./cli-command-log";

describe("isMutatingCliCommand", () => {
  test("returns true for known mutating command paths", () => {
    expect(isMutatingCliCommand(["projects", "create"])).toBe(true);
    expect(isMutatingCliCommand(["tickets", "update"])).toBe(true);
    expect(isMutatingCliCommand(["workspace", "merge"])).toBe(true);
    expect(isMutatingCliCommand(["tickets", "worktrees", "remove-all"])).toBe(true);
    expect(isMutatingCliCommand(["agents", "install-skills"])).toBe(true);
  });

  test("returns false for read-only commands", () => {
    expect(isMutatingCliCommand(["projects", "list"])).toBe(false);
    expect(isMutatingCliCommand(["sessions", "list"])).toBe(false);
    expect(isMutatingCliCommand(["tickets", "view"])).toBe(false);
  });

  test("exports the mutating command registry", () => {
    expect(MUTATING_CLI_COMMANDS.has("projects create")).toBe(true);
    expect(MUTATING_CLI_COMMANDS.has("tickets update")).toBe(true);
    expect(MUTATING_CLI_COMMANDS.has("tickets list")).toBe(false);
  });
});

describe("createCliCommandTracker", () => {
  test("logs start and completion for mutating commands", () => {
    const events: { data: Record<string, unknown>; level: "info" | "error"; message: string }[] = [];

    const tracker = createCliCommandTracker({
      logger: {
        error: (data, message) => events.push({ data, level: "error", message }),
        info: (data, message) => events.push({ data, level: "info", message }),
      },
      now: (() => {
        let t = 10;
        return () => {
          t += 5;
          return t;
        };
      })(),
      rawArgs: ["tickets", "update", "--id", "PS-1"],
      sessionId: "sess-1",
    });

    tracker.captureArgv({ _: ["tickets", "update"] });
    tracker.logStart();
    tracker.logSuccess();

    expect(events).toHaveLength(2);
    expect(events[0]?.data.event).toBe("cli.command.start");
    expect(events[1]?.data.event).toBe("cli.command.completed");
    expect(events[1]?.data.command).toBe("tickets update");
    expect(events[1]?.data.duration_ms).toBe(5);
  });

  test("does not emit events for read-only commands", () => {
    const events: { data: Record<string, unknown>; level: "info" | "error"; message: string }[] = [];
    const tracker = createCliCommandTracker({
      logger: {
        error: (data, message) => events.push({ data, level: "error", message }),
        info: (data, message) => events.push({ data, level: "info", message }),
      },
      rawArgs: ["tickets", "list"],
    });

    tracker.captureArgv({ _: ["tickets", "list"] });
    tracker.logStart();
    tracker.logSuccess();

    expect(events).toHaveLength(0);
  });
});
