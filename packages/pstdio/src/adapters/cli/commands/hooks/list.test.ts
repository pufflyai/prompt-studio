import { describe, expect, mock, test } from "bun:test";
import { createHandler } from "./list";

const baseDeps = {
  cwd: () => "/repo",
  findGitRoot: () => "/repo" as string | null,
  readConfig: () => ({ project_id: "proj-1" }) as { project_id: string } | null,
  listHooks: () => [
    { name: "pre-commit" as const, exists: true, blocking: true },
    { name: "post-create" as const, exists: false, blocking: false },
  ],
  log: mock(),
};

describe("hooks list", () => {
  test("prints hook table", async () => {
    const log = mock();
    const handler = createHandler({ ...baseDeps, log });
    await handler();

    expect(log).toHaveBeenCalledTimes(3); // header + 2 hooks
    expect(log.mock.calls[0][0]).toContain("Hook");
    expect(log.mock.calls[1][0]).toContain("pre-commit");
    expect(log.mock.calls[1][0]).toContain("yes");
    expect(log.mock.calls[2][0]).toContain("post-create");
  });

  test("throws when not in git repo", async () => {
    const handler = createHandler({ ...baseDeps, findGitRoot: () => null });
    await expect(handler()).rejects.toThrow("Not inside a git repository.");
  });
});
