import { afterEach, describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createReleaseNotes } from "./release-notes";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
  roots.length = 0;
});

const workspace = (changelogs: Record<string, string | null>) => {
  const root = mkdtempSync(join(tmpdir(), "pstdio-release-notes-"));
  roots.push(root);
  mkdirSync(join(root, ".changeset"));
  writeFileSync(join(root, "package.json"), JSON.stringify({ private: true, workspaces: ["packages/*"] }));
  writeFileSync(join(root, ".changeset/config.json"), JSON.stringify({ fixed: [Object.keys(changelogs)] }));
  for (const [name, changelog] of Object.entries(changelogs)) {
    const dir = join(root, "packages", name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name, version: "0.35.0" }));
    if (changelog !== null) writeFileSync(join(dir, "CHANGELOG.md"), changelog);
  }
  return root;
};

const runCli = async (cwd: string, ...args: string[]) => {
  const proc = Bun.spawn({
    cmd: [process.execPath, resolve(import.meta.dir, "release-notes.ts"), ...args],
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

const packageEntries = (notes: string) =>
  notes
    .split(/^## /m)
    .slice(1)
    .map((section) => {
      const [name, ...lines] = section.split(/\r?\n/);
      return {
        name: name.trim(),
        entries: lines.filter((line) => line.startsWith("- ")).map((line) => line.slice(2)),
      };
    });

describe("shared release notes", () => {
  test("includes changed independent extensions and leaves unchanged extensions out", async () => {
    const root = workspace({
      pstdio: "## 0.35.0\n\n- Host.\n",
      planner: "## 0.8.2\n\n- Planner fix.\n",
      notes: "## 0.9.1\n\n- Older Notes.\n",
    });
    writeFileSync(join(root, ".changeset/config.json"), JSON.stringify({ fixed: [["pstdio"]], ignore: [] }));
    const git = (...args: string[]) => execFileSync("git", args, { cwd: root, stdio: "pipe" });
    for (const [name, version] of [
      ["planner", "0.8.1"],
      ["notes", "0.9.1"],
    ]) {
      writeFileSync(
        join(root, "packages", name!, "package.json"),
        JSON.stringify({
          name,
          version,
          publisher: "pstdio",
          engines: { pstdio: "^0.2.0" },
          dependencies: { "@pstdio/sdk": "^0.44.0" },
        }),
      );
    }
    git("init");
    git("config", "user.email", "test@example.com");
    git("config", "user.name", "Test");
    git("add", ".");
    git("commit", "-m", "Previous host");
    git("tag", "pstdio@0.34.0");
    const file = join(root, "packages/planner/package.json");
    const planner = JSON.parse(Bun.file(file).size ? await Bun.file(file).text() : "{}");
    writeFileSync(file, JSON.stringify({ ...planner, version: "0.8.2" }));
    git("add", ".");
    git("commit", "-m", "Release Planner fix");
    expect(packageEntries(await createReleaseNotes(root, "0.35.0"))).toEqual([
      { name: "pstdio", entries: ["Host."] },
      { name: "planner", entries: ["Planner fix."] },
    ]);
  });
  test("combines each changed package's section for the release version", async () => {
    const root = workspace({
      pstdio: "## 0.35.0\n\n_2026-09-26_\n\n### Minor Changes\n\n- Add tools.\n\n## 0.34.0\n\n- Old entry.\n",
      ui: "## 0.35.0\r\n\r\n### Patch Changes\r\n\r\n- Fix layout.\r\n",
    });
    const notes = await createReleaseNotes(root, "0.35.0");
    expect(packageEntries(notes)).toEqual([
      { name: "pstdio", entries: ["Add tools."] },
      { name: "ui", entries: ["Fix layout."] },
    ]);
    expect(notes).not.toMatch(/^_\d{4}-\d{2}-\d{2}_$/m);
  });

  test("leaves out packages without entries for the release version", async () => {
    const root = workspace({ pstdio: "## 0.35.0\n\n- Change.\n", empty: "## 0.35.0\n\n_2026-09-26_\n", missing: null });
    const notes = await createReleaseNotes(root, "0.35.0");
    expect(packageEntries(notes)).toEqual([{ name: "pstdio", entries: ["Change."] }]);
  });

  test("prints default notes when every package has no entries", async () => {
    const notes = await createReleaseNotes(workspace({ empty: "## 0.35.0\n\n_2026-09-26_\n" }), "0.35.0");
    expect(packageEntries(notes)).toEqual([]);
    expect(notes.trim()).not.toBe("");
  });

  test("rejects a changelog missing the release version", async () => {
    await expect(createReleaseNotes(workspace({ pstdio: "## 0.34.0\n\n- Old.\n" }), "0.35.0")).rejects.toThrow(
      "pstdio@0.35.0",
    );
  });

  test("requires a release version", async () => {
    const result = await runCli(workspace({ pstdio: null }));
    expect(result.exitCode).toBe(1);
    expect(result.stderr.trim()).not.toBe("");
  });

  test("writes release notes to stdout and exits successfully", async () => {
    const result = await runCli(workspace({ pstdio: "## 0.35.0\n\n- Change.\n" }), "0.35.0");
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(packageEntries(result.stdout)).toEqual([{ name: "pstdio", entries: ["Change."] }]);
  });
});
