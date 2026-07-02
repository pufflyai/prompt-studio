import { describe, expect, test } from "bun:test";
import type { ExtensionTerminalApi } from "@pstdio/sdk/extensions";
import { createCommandRunner } from "./runner";
import { buildRuntime, makeStorage, stubEnvironment } from "./test-helpers.test";

describe("context factory", () => {
  test("forwards env.terminal into ctx.terminal", async () => {
    const terminal: ExtensionTerminalApi = {
      openSession: () => {
        throw new Error("not called in this test");
      },
    };

    let seen: ExtensionTerminalApi | undefined;
    const runtime = buildRuntime({
      commands: {
        probe: {
          title: "Probe",
          async run(ctx) {
            seen = ctx.terminal;
            return {};
          },
        },
      },
    });

    const { api: storage } = makeStorage();
    const runner = createCommandRunner(runtime, {
      buildEnvironment: () => ({ ...stubEnvironment(storage), terminal }),
    });

    const outcome = await runner.execute({ commandId: "lab.probe", projectId: "p1" });
    expect(outcome.ok).toBe(true);
    expect(seen).toBe(terminal);
  });

  test("ctx.terminal stays undefined when the environment has no terminal", async () => {
    let seen: unknown = "unset";
    const runtime = buildRuntime({
      commands: {
        probe: {
          title: "Probe",
          async run(ctx) {
            seen = ctx.terminal;
            return {};
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
    expect(seen).toBeUndefined();
  });
});
