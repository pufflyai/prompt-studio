import { expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { localReviewEnvironment, readReviewSource } from "./local-review-source";
import { reviewOptions } from "./run-local-review";

test("selection uses the entire branch diff, including deleted files and earlier commits", () => {
  const root = mkdtempSync(join(tmpdir(), "local-review-source-"));
  const git = (...args: string[]) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  const commit = () => {
    git("add", ".");
    git("-c", "user.name=Fixture", "-c", "user.email=fixture@example.test", "commit", "-qm", "fixture");
  };
  try {
    mkdirSync(join(root, "packages/e2e"), { recursive: true });
    writeFileSync(
      join(root, "packages/e2e/package.json"),
      JSON.stringify({ name: "e2e", scripts: { "test:smoke": "bun smoke.ts" } }),
    );
    mkdirSync(join(root, "packages/example/src"), { recursive: true });
    writeFileSync(join(root, "package.json"), JSON.stringify({ workspaces: ["packages/*"] }));
    writeFileSync(join(root, "packages/example/package.json"), JSON.stringify({ name: "example" }));
    const file = join(root, "packages/example/src/rule.ts");
    writeFileSync(file, "export const rule = 1;");
    git("init", "-q");
    commit();
    const base = git("rev-parse", "HEAD");
    rmSync(file);
    commit();
    writeFileSync(join(root, "readme.md"), "# Example\n");
    commit();
    const source = readReviewSource(root, base);
    expect(source.plan.changed).toEqual(["packages/example/src/rule.ts", "readme.md"]);
    expect(source.plan.affectedOwners).toEqual(["example"]);
    expect(source.dirty).toBe("");
    writeFileSync(file, "export {};");
    expect(readReviewSource(root, base).dirty).not.toBe("");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("concurrent runs receive separate runtime homes and caches and discard ambient test configuration", () => {
  const env = {
    PATH: "/tools",
    PSTDIO_SESSION_ID: "live",
    E2E_HOME: "/shared",
    API_TEST_REPORT_DIR: "/shared",
    TEST_PRIORITIES: "P3",
    CI_PROFILE: "production",
  };
  const first = localReviewEnvironment("/first", env);
  const second = localReviewEnvironment("/second", env);
  expect(first.PSTDIO_HOME).not.toBe(second.PSTDIO_HOME);
  expect(first.BUN_INSTALL_CACHE_DIR).not.toBe(second.BUN_INSTALL_CACHE_DIR);
  expect(first.PATH).toBe("/tools");
  expect(first.PSTDIO_SESSION_ID).toBeUndefined();
  expect(first.E2E_HOME).toBeUndefined();
  expect(first.API_TEST_REPORT_DIR).toBeUndefined();
  expect(first.TEST_PRIORITIES).toBeUndefined();
});

test("CLI selections are additive and invalid options fail rather than silently broadening", () => {
  expect(reviewOptions(["--base", "main", "--test", "first", "--test", "second", "--list"])).toEqual({
    base: "main",
    tests: ["first", "second"],
    list: true,
  });
  expect(() => reviewOptions(["--base"])).toThrow("Missing value");
  expect(() => reviewOptions(["--scope", "wrong"])).toThrow("Unknown option");
});
