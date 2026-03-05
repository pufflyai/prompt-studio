import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { runSetup, runSetupScript } from "./setup";
import { createTempRepo } from "./test-helpers";

let repo: Awaited<ReturnType<typeof createTempRepo>>;

beforeEach(async () => {
  repo = await createTempRepo();
});

afterEach(async () => {
  await repo.cleanup();
});

describe("runSetup", () => {
  test("runs a command and captures output", async () => {
    const result = await runSetup({
      worktreePath: repo.dir,
      command: ["echo", "hello setup"],
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe("hello setup");
  });

  test("captures non-zero exit code", async () => {
    const result = await runSetup({
      worktreePath: repo.dir,
      command: ["sh", "-c", "exit 42"],
    });

    expect(result.exitCode).toBe(42);
  });

  test("sets WORKTREE_PATH env var", async () => {
    const result = await runSetup({
      worktreePath: repo.dir,
      command: ["sh", "-c", "echo $WORKTREE_PATH"],
    });

    expect(result.stdout.trim()).toBe(repo.dir);
  });
});

describe("runSetupScript", () => {
  test("runs a shell script string", async () => {
    const result = await runSetupScript({
      worktreePath: repo.dir,
      script: "echo 'from script' && ls README.md",
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("from script");
    expect(result.stdout).toContain("README.md");
  });
});
