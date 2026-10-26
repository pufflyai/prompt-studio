import { afterAll, beforeAll, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { loadAttemptReadiness } from "./attempt-readiness";
import { makeCommandContext } from "./command-context.fixture";

const root = mkdtempSync(join(tmpdir(), "planner-base-revision-"));
beforeAll(() => {
  execFileSync("git", ["init", "-b", "main", root]);
  execFileSync("git", [
    "-C",
    root,
    "-c",
    "user.name=Test",
    "-c",
    "user.email=test@example.com",
    "commit",
    "--allow-empty",
    "-m",
    "Initial",
  ]);
});
afterAll(() => rmSync(root, { recursive: true, force: true }));

const context = () =>
  makeCommandContext({
    storage: createMemoryStorage(),
    params: {},
    overrides: {
      workspaces: { getDefault: async () => ({ id: "home", root_path: root, execution_kind: "local" }) },
      process: {
        run: async ({ command }) => {
          const child = Bun.spawn(command, { stdout: "pipe", stderr: "pipe" });
          const [stdout, stderr, exitCode] = await Promise.all([
            new Response(child.stdout).text(),
            new Response(child.stderr).text(),
            child.exited,
          ]);
          return { stdout, stderr, exitCode };
        },
      },
    },
  });

test("resolves a commit revision as an attempt base", async () => {
  const result = await loadAttemptReadiness(context(), "T-1", { base: "main" });
  expect(result.readiness).toMatchObject({
    decision: "ready",
    baseHeadSha: execFileSync("git", ["-C", root, "rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  });
});

test.each(["--is-inside-work-tree", "HEAD^{tree}"])("rejects %s as an attempt base", async (base) => {
  await expect(loadAttemptReadiness(context(), "T-1", { base })).rejects.toThrow();
});
