import { expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("PR selection resolves the public benchmark registry before dependency installation", () => {
  const root = mkdtempSync(join(tmpdir(), "ci-scope-before-install-"));
  const git = (...args: string[]) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  const commit = () => {
    git("add", ".");
    git("-c", "user.name=Fixture", "-c", "user.email=fixture@example.test", "commit", "--quiet", "-m", "fixture");
  };
  try {
    cpSync(import.meta.dirname, join(root, "scripts/ci"), {
      recursive: true,
      filter: (path) => !path.endsWith(".test.ts"),
    });
    const benchmark = join(root, "packages/benchmarks");
    mkdirSync(benchmark, { recursive: true });
    copyFileSync(join(import.meta.dirname, "../../packages/benchmarks/package.json"), join(benchmark, "package.json"));
    cpSync(join(import.meta.dirname, "../../packages/benchmarks/src"), join(benchmark, "src"), {
      recursive: true,
      filter: (path) => !path.endsWith(".test.ts"),
    });
    writeFileSync(join(root, "package.json"), JSON.stringify({ workspaces: ["packages/*"] }));
    git("init", "--quiet");
    commit();
    const base = git("rev-parse", "HEAD");
    const file = "packages/benchmarks/src/new.p1.test.ts";
    writeFileSync(join(root, file), "export {};");
    commit();
    const event = join(root, "event.json");
    const output = join(root, "outputs.txt");
    writeFileSync(event, JSON.stringify({ pull_request: { base: { sha: base } } }));
    execFileSync(process.execPath, ["scripts/ci/pull-request-ci-scope.ts"], {
      cwd: root,
      env: {
        ...process.env,
        CI_PROFILE: "",
        GITHUB_EVENT_NAME: "pull_request",
        GITHUB_EVENT_PATH: event,
        GITHUB_OUTPUT: output,
        GITHUB_STEP_SUMMARY: "",
        PULL_REQUEST_LABELS: "[]",
      },
      stdio: "pipe",
    });
    expect(existsSync(join(root, "node_modules"))).toBe(false);
    const line = readFileSync(output, "utf8")
      .split("\n")
      .find((line) => line.startsWith("editedMatrix="))!;
    expect(JSON.parse(line.slice("editedMatrix=".length))).toMatchObject([
      { owner: "pstdio-benchmarks", priority: "P1", files: JSON.stringify([file]) },
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
