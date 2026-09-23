import { describe, expect, test } from "bun:test";
import { type CommandRunnerEnvironment, createCommandRunner } from "./runner";
import { buildRuntime, makeStorage, stubEnvironment } from "./test-helpers.test";

describe("createCommandRunner: workspace context", () => {
  test("passes the selected workspace to the environment and exposes its file mounts", async () => {
    const runtime = buildRuntime({
      commands: [
        {
          id: "files.peek",
          ref: { kind: "command", id: "files.peek" },
          title: "Peek",
          async run(ctx) {
            return { hasProjectFiles: Boolean(ctx.projectFiles), workspaceId: ctx.workspaceId };
          },
        },
      ],
    });
    const { api: storage } = makeStorage();

    let seenWorkspaceId: string | undefined;
    const runner = createCommandRunner(runtime, {
      buildEnvironment: (input) => {
        seenWorkspaceId = input.workspaceId;
        return {
          ...stubEnvironment(storage),
          workspaceId: input.workspaceId,
          projectFiles: input.workspaceId ? ({} as CommandRunnerEnvironment["projectFiles"]) : undefined,
        };
      },
    });

    const outcome = await runner.execute({
      commandId: "pstdio.lab.command.files.peek",
      projectId: "p1",
      workspaceId: "workspace-1",
    });

    expect(seenWorkspaceId).toBe("workspace-1");
    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(outcome.value).toEqual({ hasProjectFiles: true, workspaceId: "workspace-1" });
  });

  test("honors the file mounts supplied by the host", async () => {
    const runtime = buildRuntime({
      commands: [
        {
          id: "files.peek",
          ref: { kind: "command", id: "files.peek" },
          title: "Peek",
          async run(ctx) {
            return { hasProjectFiles: Boolean(ctx.projectFiles) };
          },
        },
      ],
    });
    const { api: storage } = makeStorage();

    const runner = createCommandRunner(runtime, {
      buildEnvironment: (input) => ({
        ...stubEnvironment(storage),
        workspaceId: input.workspaceId,
        projectFiles: input.workspaceId ? ({} as CommandRunnerEnvironment["projectFiles"]) : undefined,
      }),
    });

    const outcome = await runner.execute({ commandId: "pstdio.lab.command.files.peek", projectId: "p1" });
    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(outcome.value).toEqual({ hasProjectFiles: false });
  });
});
