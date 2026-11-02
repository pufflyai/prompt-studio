import { afterEach, expect, test } from "bun:test";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readManifest, resolveOut } from "./build";
import type { CanvasBuildManifest } from "./manifest";
import { createTestProject, sampleProject, writeProjectFiles } from "./test-project";
import { watchCanvases } from "./watch";

const cleanups: (() => void | Promise<void>)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

const nextManifest = async (out: string, after?: string) => {
  for (let attempt = 0; attempt < 200; attempt++) {
    const manifest = await readManifest(out);
    if (manifest && manifest.builtAt !== after) return manifest;
    await Bun.sleep(50);
  }
  throw new Error("The watcher wrote no new build");
};
const moduleOf = (manifest: CanvasBuildManifest, id: string) =>
  manifest.frames.modules[manifest.frames.sources[id]!.script]!.file;

test("closing waits for an active scheduled build to finish before the project is removed", async () => {
  const project = createTestProject(sampleProject);
  const exitCodes: number[] = [];
  const watcher = watchCanvases({ root: project.root, intervalMs: 10, onBuild: (code) => exitCodes.push(code) });
  const out = resolveOut(project.root);
  const enteredBuild = join(out, ".gitignore");
  try {
    await watcher.started;
    // Hold the next real builder at its output lock until close terminates it.
    rmSync(enteredBuild);
    writeFileSync(join(out, "build.lock"), String(process.pid));
    writeProjectFiles(project.root, {
      "src/button.tsx": "export const Button = () => <button>Changed</button>;\n",
    });
    for (let attempt = 0; attempt < 200 && !existsSync(enteredBuild); attempt++) await Bun.sleep(10);
    expect(existsSync(enteredBuild)).toBe(true);
    await watcher.close();
    expect(exitCodes).toHaveLength(2);
    expect(exitCodes[1]).not.toBe(0);
  } finally {
    await watcher.close();
    project.dispose();
  }
});

test("rebuilds when a component changes, replacing only that canvas's module", async () => {
  const project = createTestProject(sampleProject);
  cleanups.push(project.dispose);
  const watcher = watchCanvases({ root: project.root, intervalMs: 50 });
  cleanups.push(watcher.close);
  const out = resolveOut(project.root);

  const first = await nextManifest(out);
  writeProjectFiles(project.root, {
    "src/button.tsx": `export const Button = (props: { label: string }) => <button>{props.label}!</button>;\n`,
  });
  const second = await nextManifest(out, first.builtAt);

  expect(moduleOf(second, "src/button.canvas.tsx")).not.toBe(moduleOf(first, "src/button.canvas.tsx"));
  expect(moduleOf(second, "src/card.canvas.tsx")).toBe(moduleOf(first, "src/card.canvas.tsx"));
});

test("picks up a new canvas file", async () => {
  const project = createTestProject(sampleProject);
  cleanups.push(project.dispose);
  const watcher = watchCanvases({ root: project.root, intervalMs: 50 });
  cleanups.push(watcher.close);
  const out = resolveOut(project.root);

  const first = await nextManifest(out);
  writeProjectFiles(project.root, { "src/badge.canvas.tsx": "export const Default = () => <span>New</span>;\n" });
  const second = await nextManifest(out, first.builtAt);
  expect(second.canvases.map((canvas) => canvas.id)).toContain("src/badge.canvas.tsx");
});

test("a build that keeps failing runs again only after an input changes", async () => {
  const project = createTestProject(sampleProject);
  cleanups.push(project.dispose);
  // An output path that is a file makes every build fail before it starts.
  writeProjectFiles(project.root, { "blocked-output": "" });
  const exitCodes: number[] = [];
  const watcher = watchCanvases({
    root: project.root,
    out: "blocked-output",
    intervalMs: 50,
    onBuild: (code) => exitCodes.push(code),
  });
  cleanups.push(watcher.close);

  await watcher.started;
  await Bun.sleep(500);
  expect(exitCodes).toHaveLength(1);
  expect(exitCodes[0]).not.toBe(0);

  writeProjectFiles(project.root, {
    "src/card.canvas.tsx": "export const Default = () => <section>Edited</section>;\n",
  });
  for (let attempt = 0; attempt < 60 && exitCodes.length < 2; attempt++) await Bun.sleep(50);
  expect(exitCodes).toHaveLength(2);
});
