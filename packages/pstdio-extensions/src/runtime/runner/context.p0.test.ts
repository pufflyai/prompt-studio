import { describe, expect, test } from "bun:test";
import type { ExtensionTerminalApi } from "@pstdio/sdk/extensions";
import { createCommandRunner } from "./runner";
import { buildRuntime, makeStorage, stubEnvironment } from "./runner.test-fixture";

describe("context factory", () => {
  test("forwards env.terminal into ctx.terminal", async () => {
    const terminal: ExtensionTerminalApi = {
      openSession: () => {
        throw new Error("not called in this test");
      },
    };

    let seen: ExtensionTerminalApi | undefined;
    const runtime = buildRuntime({
      commands: [
        {
          id: "probe",
          ref: { kind: "command", id: "probe" },
          title: "Probe",
          async run(ctx) {
            seen = ctx.terminal;
            return {};
          },
        },
      ],
    });

    const { api: storage } = makeStorage();
    const runner = createCommandRunner(runtime, {
      buildEnvironment: () => stubEnvironment(storage, { terminal }),
    });

    const outcome = await runner.execute({ commandId: "pstdio.lab.command.probe", projectId: "p1" });
    expect(outcome.ok).toBe(true);
    expect(seen).toBe(terminal);
  });

  test("ctx.terminal stays undefined when the environment has no terminal", async () => {
    let seen: unknown = "unset";
    const runtime = buildRuntime({
      commands: [
        {
          id: "probe",
          ref: { kind: "command", id: "probe" },
          title: "Probe",
          async run(ctx) {
            seen = ctx.terminal;
            return {};
          },
        },
      ],
    });

    const { api: storage } = makeStorage();
    const runner = createCommandRunner(runtime, {
      buildEnvironment: () => stubEnvironment(storage),
    });

    const outcome = await runner.execute({ commandId: "pstdio.lab.command.probe", projectId: "p1" });
    expect(outcome.ok).toBe(true);
    expect(seen).toBeUndefined();
  });
});

test("Activity receives the current command source without sharing another invocation's author", async () => {
  const { api: storage } = makeStorage();
  const seen: unknown[] = [];
  const runtime = buildRuntime({
    commands: [
      {
        id: "activity",
        ref: { kind: "command", id: "activity" },
        title: "Activity",
        async run(ctx) {
          seen.push(ctx.activity);
          return {};
        },
      },
    ],
  });
  const user = stubEnvironment(storage).activity;
  const system = stubEnvironment(storage).activity;
  const sources: unknown[] = [];
  const runner = createCommandRunner(runtime, {
    buildEnvironment: () =>
      stubEnvironment(storage, {
        activityForInvocation: (source) => {
          sources.push(source);
          return source === "dashboard" ? user : system;
        },
      }),
  });
  await runner.execute({ commandId: "pstdio.lab.command.activity", projectId: "p1", source: "dashboard" });
  await runner.execute({ commandId: "pstdio.lab.command.activity", projectId: "p1", source: "automation" });
  expect(sources).toEqual(["dashboard", "automation"]);
  expect(seen).toEqual([user, system]);
});
