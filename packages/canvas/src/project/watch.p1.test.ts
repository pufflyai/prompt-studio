import { afterEach, expect, test } from "bun:test";
import { readManifest, resolveOut } from "./build";
import type { CanvasBuildManifest } from "./manifest";
import { createTestProject, sampleProject, writeProjectFiles } from "./test-project";
import { watchCanvases } from "./watch";

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
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
