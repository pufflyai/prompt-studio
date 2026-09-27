import { afterEach, describe, expect, test } from "bun:test";
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

const runWithoutVersion = async (cwd: string) => {
  const proc = Bun.spawn({
    cmd: [process.execPath, resolve(import.meta.dir, "release-notes.ts")],
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
    const result = await runWithoutVersion(workspace({ pstdio: null }));
    expect(result.exitCode).toBe(1);
    expect(result.stderr.trim()).not.toBe("");
  });
});
