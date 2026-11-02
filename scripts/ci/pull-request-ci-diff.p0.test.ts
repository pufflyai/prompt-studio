import { expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("PR scope uses the tested merge parent when the base branch advances beyond event metadata", async () => {
  const root = mkdtempSync(join(tmpdir(), "ci-advanced-base-"));
  const git = (...args: string[]) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  const write = (path: string, text: string) => writeFileSync(join(root, path), text);
  const commit = () => {
    git("add", ".");
    git("-c", "user.name=Fixture", "-c", "user.email=fixture@example.test", "commit", "--quiet", "-m", "fixture");
  };
  try {
    git("init", "--quiet", "--initial-branch=main");
    mkdirSync(join(root, "packages/e2e/src/ui"), { recursive: true });
    write("package.json", JSON.stringify({ workspaces: ["packages/*"] }));
    write("packages/e2e/package.json", JSON.stringify({ name: "e2e" }));
    const edited = "packages/e2e/src/ui/edited.p2.spec.ts";
    write(edited, "original");
    write("packages/e2e/src/ui/unchanged.p1.spec.ts", "unchanged");
    commit();
    const originalBase = git("rev-parse", "HEAD");
    git("checkout", "--quiet", "-b", "feature");
    write(edited, "edited");
    commit();
    write("README.md", "later PR commit");
    commit();
    git("checkout", "--quiet", "main");
    write("packages/e2e/src/shared-fixture.ts", "upstream-only fixture");
    commit();
    git(
      "-c",
      "user.name=Fixture",
      "-c",
      "user.email=fixture@example.test",
      "merge",
      "--quiet",
      "--no-ff",
      "feature",
      "-m",
      "candidate",
    );
    const event = join(root, "event.json");
    writeFileSync(event, JSON.stringify({ pull_request: { base: { sha: originalBase } } }));
    const output = join(root, "outputs");
    const child = Bun.spawn([process.execPath, join(import.meta.dir, "pull-request-ci-scope.ts")], {
      cwd: root,
      env: {
        ...process.env,
        CI_PROFILE: "",
        GITHUB_EVENT_NAME: "pull_request",
        GITHUB_EVENT_PATH: event,
        GITHUB_OUTPUT: output,
        GITHUB_STEP_SUMMARY: "",
      },
      stdout: "pipe",
      stderr: "pipe",
    });
    const [stdout, stderr, code] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
    expect({ code, output: stdout + stderr }).toMatchObject({ code: 0 });
    const line = (await Bun.file(output).text()).split("\n").find((line) => line.startsWith("editedMatrix="))!;
    const rows = JSON.parse(line.slice("editedMatrix=".length));
    expect(rows.flatMap((row: { files: string }) => JSON.parse(row.files))).toEqual([edited]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
