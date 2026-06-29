import { describe, expect, test } from "bun:test";
import type { ExtensionTerminalApi, TerminalSessionHandle } from "@pstdio/sdk/extensions";
import { createCommandRunner } from "./runner";
import { buildRuntime, makeStorage, stubEnvironment } from "./test-helpers.test";

describe("command runner context", () => {
  test("forwards env.terminal to ctx.terminal when supplied", async () => {
    const requests: unknown[] = [];
    const stubHandle = {
      id: "terminal-1",
      write: () => {},
      resize: () => {},
      kill: async () => {},
      events: async function* () {},
    } satisfies TerminalSessionHandle;
    const terminal: ExtensionTerminalApi = {
      openSession(request) {
        requests.push(request);
        return stubHandle;
      },
    };

    const { api: storage } = makeStorage();
    const runtime = buildRuntime({
      commands: {
        spawn: {
          title: "Spawn",
          async run(ctx) {
            if (!ctx.terminal) throw new Error("ctx.terminal missing");
            const handle = ctx.terminal.openSession({ cols: 80, rows: 24 });
            return { sessionId: handle.id };
          },
        },
      },
    });

    const runner = createCommandRunner(runtime, {
      buildEnvironment: () => ({ ...stubEnvironment(storage), terminal }),
    });

    const outcome = await runner.execute({ commandId: "lab.spawn", projectId: "p1" });
    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(outcome.value).toEqual({ sessionId: "terminal-1" });
    expect(requests).toEqual([{ cols: 80, rows: 24 }]);
  });

  test("leaves ctx.terminal undefined when the host omits a supervisor", async () => {
    const runtime = buildRuntime({
      commands: {
        probe: {
          title: "Probe",
          async run(ctx) {
            return { hasTerminal: Boolean(ctx.terminal) };
          },
        },
      },
    });
    const { api: storage } = makeStorage();
    const runner = createCommandRunner(runtime, {
      buildEnvironment: () => stubEnvironment(storage),
    });

    const outcome = await runner.execute({ commandId: "lab.probe", projectId: "p1" });
    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(outcome.value).toEqual({ hasTerminal: false });
  });
});
