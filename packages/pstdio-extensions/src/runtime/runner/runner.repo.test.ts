import { describe, expect, test } from "bun:test";
import { type CommandRunnerEnvironment, createCommandRunner } from "./runner";
import { buildRuntime, makeStorage, stubEnvironment } from "./test-helpers.test";

describe("createCommandRunner: repo threading", () => {
  test("forwards the invocation repo into buildEnvironment and exposes ctx.repoFiles", async () => {
    const runtime = buildRuntime({
      commands: [
        {
          id: "files.peek",
          ref: { kind: "command", id: "files.peek" },
          title: "Peek",
          async run(ctx) {
            return { hasRepoFiles: Boolean(ctx.repoFiles), repoPath: ctx.repo?.path };
          },
        },
      ],
    });
    const { api: storage } = makeStorage();

    let seenRepoPath: string | undefined;
    const runner = createCommandRunner(runtime, {
      buildEnvironment: (input) => {
        seenRepoPath = input.repo?.path;
        return {
          ...stubEnvironment(storage),
          repoFiles: input.repo ? ({} as CommandRunnerEnvironment["repoFiles"]) : undefined,
        };
      },
    });

    const outcome = await runner.execute({
      commandId: "pstdio.lab.command.files.peek",
      projectId: "p1",
      repo: { projectId: "p1", repoId: "r1", path: "/repo/root" },
    });

    expect(seenRepoPath).toBe("/repo/root");
    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(outcome.value).toEqual({ hasRepoFiles: true, repoPath: "/repo/root" });
  });

  test("repoFiles is absent when the invocation has no repo", async () => {
    const runtime = buildRuntime({
      commands: [
        {
          id: "files.peek",
          ref: { kind: "command", id: "files.peek" },
          title: "Peek",
          async run(ctx) {
            return { hasRepoFiles: Boolean(ctx.repoFiles) };
          },
        },
      ],
    });
    const { api: storage } = makeStorage();

    const runner = createCommandRunner(runtime, {
      buildEnvironment: (input) => ({
        ...stubEnvironment(storage),
        repoFiles: input.repo ? ({} as CommandRunnerEnvironment["repoFiles"]) : undefined,
      }),
    });

    const outcome = await runner.execute({ commandId: "pstdio.lab.command.files.peek", projectId: "p1" });
    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(outcome.value).toEqual({ hasRepoFiles: false });
  });
});
