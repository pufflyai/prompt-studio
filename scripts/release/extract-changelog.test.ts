import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

const tempDirs: string[] = [];

const makeTempDir = () => {
  const dir = mkdtempSync(join(tmpdir(), "pstdio-extract-changelog-"));
  tempDirs.push(dir);
  return dir;
};

afterEach(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
  tempDirs.length = 0;
});

const runExtractChangelog = async (cwd: string, name: string, version: string) => {
  const proc = Bun.spawn({
    cmd: ["bun", resolve(import.meta.dir, "extract-changelog.ts"), name, version],
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  return { stdout, stderr, exitCode };
};

describe("extract-changelog", () => {
  test("prints default notes for packages without a changelog", async () => {
    const root = makeTempDir();
    const packageJson = join(root, "extensions", "sample-extension", "package.json");

    mkdirSync(dirname(packageJson), { recursive: true });
    mkdirSync(join(root, "packages"), { recursive: true });
    writeFileSync(packageJson, JSON.stringify({ name: "sample-extension" }));

    const result = await runExtractChangelog(root, "sample-extension", "0.1.0");

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toBe("_No changelog entry._\n");
  });
});
