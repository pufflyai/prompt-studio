import { describe, expect, mock, test } from "bun:test";
import { createHandler } from "./create";

const baseDeps = {
  cwd: () => "/repo",
  findGitRoot: () => "/repo" as string | null,
  listHooks: () => [
    { name: "pre-commit" as const, exists: false, blocking: true },
    { name: "post-session-start" as const, exists: false, blocking: false },
  ],
  createHookFile: mock(async () => "/repo/.pstdio/hooks/pre-commit"),
  log: mock(),
};

describe("hooks create", () => {
  test("creates a supported hook file", async () => {
    const createHookFile = mock(async () => "/repo/.pstdio/hooks/pre-commit");
    const log = mock();
    const handler = createHandler({ ...baseDeps, createHookFile, log });

    await handler({ hook: "pre-commit", _: [], $0: "" } as never);

    expect(createHookFile).toHaveBeenCalledWith("/repo", "pre-commit");
    expect(log).toHaveBeenCalledWith('Created hook "pre-commit" at .pstdio/hooks/pre-commit');
  });

  test("throws when hook name is not supported", async () => {
    const handler = createHandler(baseDeps);

    await expect(handler({ hook: "pre-create", _: [], $0: "" } as never)).rejects.toThrow(
      'Unsupported hook: "pre-create"',
    );
  });

  test("throws when not in git repo", async () => {
    const handler = createHandler({ ...baseDeps, findGitRoot: () => null });

    await expect(handler({ hook: "pre-commit", _: [], $0: "" } as never)).rejects.toThrow(
      "Not inside a git repository.",
    );
  });
});
