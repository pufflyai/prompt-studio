import { describe, expect, mock, test } from "bun:test";
import { createHandler } from "./run";

const skippedResult = { hook: "pre-commit" as const, skipped: true, exitCode: 0, stdout: "", stderr: "" };
const successResult = { hook: "pre-commit" as const, skipped: false, exitCode: 0, stdout: "ok\n", stderr: "" };
const failResult = { hook: "pre-commit" as const, skipped: false, exitCode: 1, stdout: "", stderr: "lint failed\n" };

const baseDeps = {
  cwd: () => "/repo",
  findGitRoot: () => "/repo" as string | null,
  readConfig: () => ({ project_id: "proj-1" }) as { project_id: string } | null,
  runHook: mock(async () => skippedResult),
  log: mock(),
};

describe("hooks run", () => {
  test("logs message when hook not found", async () => {
    const log = mock();
    const handler = createHandler({ ...baseDeps, runHook: async () => skippedResult, log });
    await handler({ hook: "pre-commit", _: [], $0: "" } as never);

    expect(log).toHaveBeenCalledWith('No hook script found for "pre-commit".');
  });

  test("prints stdout on success", async () => {
    const log = mock();
    const handler = createHandler({ ...baseDeps, runHook: async () => successResult, log });
    await handler({ hook: "pre-commit", _: [], $0: "" } as never);

    expect(log).toHaveBeenCalledWith("ok");
  });

  test("throws on hook failure", async () => {
    const handler = createHandler({ ...baseDeps, runHook: async () => failResult });
    await expect(handler({ hook: "pre-commit", _: [], $0: "" } as never)).rejects.toThrow(
      "HOOK pre-commit FAILED (exit 1)",
    );
  });

  test("throws when not in git repo", async () => {
    const handler = createHandler({ ...baseDeps, findGitRoot: () => null });
    await expect(handler({ hook: "pre-commit", _: [], $0: "" } as never)).rejects.toThrow(
      "Not inside a git repository.",
    );
  });
});
