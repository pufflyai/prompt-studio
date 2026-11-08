import { mkdtempSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ExtensionWorkspace, ProcessRunInput } from "@pstdio/sdk/extensions";
import { createMemoryStorage, makeCommandContext } from "@pstdio/sdk/testing";

export const gitFixture = async (commit = true) => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "git-workspaces-")));
  const run = async (input: ProcessRunInput) => {
    const child = Bun.spawn(input.command, {
      cwd: input.cwd ?? root,
      env: { ...process.env, ...input.env },
      stdout: "pipe",
      stderr: "pipe",
    });
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
    return { stdout, stderr, exitCode };
  };
  const runOrThrow = async (input: ProcessRunInput) => {
    const result = await run(input);
    if (result.exitCode) throw new Error(result.stderr.trim());
    return result;
  };
  const git = async (...args: string[]) => (await runOrThrow({ command: ["git", ...args] })).stdout.trim();
  await git("init", "-b", "main");
  await git("config", "user.name", "Test");
  await git("config", "user.email", "test@example.com");
  if (commit) {
    writeFileSync(join(root, "README.md"), "Workspace\n");
    await git("add", "README.md");
    await git("commit", "-m", "Initial commit");
  }
  const context = (
    home: ExtensionWorkspace | null = { id: "home", isDefault: true, rootPath: root, executionKind: "local" },
  ) =>
    makeCommandContext({
      storage: createMemoryStorage(),
      params: {},
      overrides: {
        workspaces: { getDefault: async () => home },
        process: {
          run,
          runOrThrow,
          spawnDetached: async () => {
            throw new Error("No detached fixture processes");
          },
        },
      },
    });
  return { root, git, context };
};
