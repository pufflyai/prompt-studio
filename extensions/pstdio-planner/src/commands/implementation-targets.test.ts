import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ProcessRunInput } from "@pstdio/sdk/extensions";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { makeCommandContext } from "./command-context.fixture";
import { implementationPolicyCommand } from "./implementation-policy";
import { implementationTargetsCommand, setImplementationTargetCommand } from "./implementation-targets";

const folders: string[] = [];
afterEach(async () => {
  await Promise.all(folders.splice(0).map((folder) => rm(folder, { recursive: true, force: true })));
});

const run = async (input: ProcessRunInput) => {
  const child = Bun.spawn(input.command, { cwd: input.cwd, stdout: "pipe", stderr: "pipe" });
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  return { exitCode, stdout, stderr };
};
const runOrThrow = async (input: ProcessRunInput) => {
  const result = await run(input);
  if (result.exitCode !== 0) throw new Error(result.stderr);
  return result;
};

const setup = async (gitFolder = true) => {
  const path = await mkdtemp(join(tmpdir(), "planner-targets-"));
  folders.push(path);
  const git = (...args: string[]) => runOrThrow({ command: ["git", ...args], cwd: path });
  if (gitFolder) {
    await git("init", "-b", "main");
    await git("-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "--allow-empty", "-m", "Initial");
    await git("branch", "local-only");
    await git("update-ref", "refs/remotes/origin/main", "HEAD");
    await git("update-ref", "refs/remotes/origin/release/next", "HEAD");
    await git("symbolic-ref", "refs/remotes/origin/HEAD", "refs/remotes/origin/main");
  }
  const settings: Record<string, unknown> = {
    "implementation.adversarialReview": true,
    "implementation.openPr": true,
    "implementation.defaultTargetBranch": "",
  };
  const ctx = makeCommandContext({
    storage: createMemoryStorage(),
    params: {},
    overrides: {
      workspaces: {
        getDefault: async () => ({ id: "default", root_path: path, execution_kind: "local" }),
      },
      process: { run, runOrThrow },
      settings: {
        all: async () => settings,
        set: async (key, value) => {
          settings[key] = value;
        },
        delete: async (key) => {
          delete settings[key];
        },
      },
    },
  });
  return { ctx, settings };
};

describe("project implementation target branches", () => {
  test("lists remote branches in the project folder without local or symbolic refs", async () => {
    const { ctx } = await setup();
    expect(await implementationTargetsCommand.run(ctx, {})).toEqual({
      branches: ["origin/main", "origin/release/next"],
      selected: "",
    });
  });

  test("shares the project target with commands invoked from an attempt workspace", async () => {
    const { ctx, settings } = await setup();
    await setImplementationTargetCommand.run(ctx, { branch: "origin/release/next" });
    ctx.workspaceId = "attempt-workspace";
    expect(settings["implementation.defaultTargetBranch"]).toBe("origin/release/next");
    expect(await implementationPolicyCommand.run(ctx, {})).toMatchObject({
      defaultTargetBranch: "origin/release/next",
    });
    expect(await implementationTargetsCommand.run(ctx, {})).toMatchObject({ selected: "origin/release/next" });
  });

  test("clears the override to use the repository default", async () => {
    const { ctx } = await setup();
    await setImplementationTargetCommand.run(ctx, { branch: "origin/main" });
    await setImplementationTargetCommand.run(ctx, {});
    expect(await implementationPolicyCommand.run(ctx, {})).toMatchObject({ defaultTargetBranch: null });
    expect(await implementationTargetsCommand.run(ctx, {})).toMatchObject({ selected: "" });
  });

  test("keeps workflow options available for non-Git project folders", async () => {
    const { ctx } = await setup(false);
    expect(await implementationTargetsCommand.run(ctx, {})).toBeNull();
    expect(await implementationPolicyCommand.run(ctx, {})).toEqual({
      adversarialReview: true,
      openPr: true,
      defaultTargetBranch: null,
    });
  });

  test("does not read local Git branches for a remote project workspace", async () => {
    const { ctx } = await setup(false);
    ctx.workspaces.getDefault = async () => ({ id: "remote", execution_kind: "remote", root_path: null });
    expect(await implementationTargetsCommand.run(ctx, {})).toBeNull();
  });

  test("rejects branches that are not remote branches in the project folder", async () => {
    const { ctx, settings } = await setup();
    await expect(setImplementationTargetCommand.run(ctx, { branch: "local-only" })).rejects.toThrow(
      "Unknown remote branch",
    );
    expect(settings["implementation.defaultTargetBranch"]).toBe("");
  });
});
