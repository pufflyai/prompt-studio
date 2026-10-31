import { expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { collectStoryCatalog, generatedRoot, sourceFiles } from "./story-catalog";

test("the catalog includes current indexed and new sources while ignoring unstaged deletions", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "canvas-source-scan-"));
  try {
    const directory = resolve(root, "packages/ui/src");
    await mkdir(directory, { recursive: true });
    execFileSync("git", ["init", "--quiet"], { cwd: root });
    for (const name of ["kept.canvas.tsx", "removed.canvas.tsx"])
      await writeFile(resolve(directory, name), "export default {};");
    execFileSync("git", ["add", "."], { cwd: root });
    await rm(resolve(directory, "removed.canvas.tsx"));
    await writeFile(resolve(directory, "new.canvas.tsx"), "export default {};");
    expect(await sourceFiles(root)).toEqual(["packages/ui/src/kept.canvas.tsx", "packages/ui/src/new.canvas.tsx"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("every exported story is reachable from UI Canvas", async () => {
  const source = await collectStoryCatalog();
  const generated = JSON.parse(await readFile(resolve(generatedRoot, "stories.json"), "utf8"));
  const identities = (stories: { source: string; exportName: string }[]) =>
    stories.map((story) => `${story.source}#${story.exportName}`).sort();
  expect(identities(generated.stories)).toEqual(identities(source.stories));
  expect(new Set(generated.stories.map((story: { id: string }) => story.id)).size).toBe(source.stories.length);
});
