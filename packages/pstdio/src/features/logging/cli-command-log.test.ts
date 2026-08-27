import { describe, expect, test } from "bun:test";
import { createCliCommandTracker, isMutatingCliCommand, MUTATING_CLI_COMMANDS } from "./cli-command-log";

describe("isMutatingCliCommand", () => {
  test("returns true for known mutating command paths", () => {
    expect(isMutatingCliCommand(["projects", "create"])).toBe(true);
    expect(isMutatingCliCommand(["tickets", "update"], true)).toBe(true);
    expect(isMutatingCliCommand(["workspace", "merge"])).toBe(true);
    expect(isMutatingCliCommand(["tickets", "worktrees", "remove-all"], true)).toBe(true);
    expect(isMutatingCliCommand(["agents", "install-skills"])).toBe(true);
  });

  test("returns false for read-only commands", () => {
    expect(isMutatingCliCommand(["projects", "list"])).toBe(false);
    expect(isMutatingCliCommand(["sessions", "list"])).toBe(false);
    expect(isMutatingCliCommand(["tickets", "view"])).toBe(false);
  });

  test("exports the mutating command registry", () => {
    expect(MUTATING_CLI_COMMANDS.has("projects create")).toBe(true);
    expect(MUTATING_CLI_COMMANDS.has("tickets update")).toBe(false);
    expect(MUTATING_CLI_COMMANDS.has("tickets list")).toBe(false);
  });
});

describe("createCliCommandTracker", () => {
  test("logs a command after extension metadata marks it as mutating", () => {
    const events: unknown[] = [];
    const tracker = createCliCommandTracker({
      logger: {
        error: (data) => events.push(data),
        info: (data) => events.push(data),
      },
      rawArgs: ["tickets", "update"],
    });

    tracker.setMutating(true);
    tracker.logStart();
    tracker.logSuccess();

    expect(events).toHaveLength(2);
  });
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
    tracker.setMutating(true);
    tracker.logStart();
    tracker.logSuccess();

    expect(events).toHaveLength(2);
    expect(events[0]?.data.event).toBe("cli.command.start");
    expect(events[0]?.data).not.toHaveProperty("raw_args");
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

  test("redacts the runtime token from command failures", () => {
    const previous = process.env.PSTDIO_API_TOKEN;
    const events: { data: Record<string, unknown> }[] = [];
    process.env.PSTDIO_API_TOKEN = "runtime-secret";

    try {
      const tracker = createCliCommandTracker({
        logger: {
          error: (data) => events.push({ data }),
          info: (data) => events.push({ data }),
        },
        rawArgs: ["tickets", "update", "--content", "runtime-secret"],
      });
      tracker.captureArgv({ _: ["tickets", "update"] });
      tracker.setMutating(true);
      tracker.logFailure(new Error("failed with runtime-secret"));

      expect(JSON.stringify(events)).not.toContain("runtime-secret");
      expect(JSON.stringify(events)).toContain("[Redacted]");
    } finally {
      if (previous === undefined) delete process.env.PSTDIO_API_TOKEN;
      else process.env.PSTDIO_API_TOKEN = previous;
    }
  });
});
