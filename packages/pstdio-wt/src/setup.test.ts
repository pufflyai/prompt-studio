import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runSetup, runSetupScript } from "./setup";

let worktreePath: string;

beforeEach(async () => {
  worktreePath = await realpath(await mkdtemp(join(tmpdir(), "pstdio-wt-setup-test-")));
  await Bun.write(join(worktreePath, "README.md"), "# test repo\n");
});

afterEach(async () => {
  await rm(worktreePath, { recursive: true, force: true });
});

describe("runSetup", () => {
  test("runs a command and captures output", async () => {
    const result = await runSetup({
      worktreePath,
      command: ["echo", "hello setup"],
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe("hello setup");
  });

  test("captures non-zero exit code", async () => {
    const result = await runSetup({
      worktreePath,
      command: ["sh", "-c", "exit 42"],
    });

    expect(result.exitCode).toBe(42);
  });

  test("sets WORKTREE_PATH env var", async () => {
    const result = await runSetup({
      worktreePath,
      command: ["sh", "-c", "echo $WORKTREE_PATH"],
    });

    expect(result.stdout.trim()).toBe(worktreePath);
  });
});

describe("runSetupScript", () => {
  test("runs a shell script string", async () => {
    const result = await runSetupScript({
      worktreePath,
      script: "echo 'from script' && ls README.md",
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("from script");
    expect(result.stdout).toContain("README.md");
  });
});
