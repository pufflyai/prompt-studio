import { afterEach, expect, test } from "bun:test";
import { existsSync, readFileSync, utimesSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { buildCanvases, resolveOut } from "./build";
import { createTestProject, sampleProject, writeProjectFiles } from "./test-project";

const projects: { dispose: () => void }[] = [];
afterEach(() => {
  for (const project of projects.splice(0)) project.dispose();
});
const project = (files = sampleProject) => {
  const created = createTestProject(files);
  projects.push(created);
  return created.root;
};
const moduleCode = (out: string, file: string) =>
  gunzipSync(Buffer.from(readFileSync(join(out, file), "utf8"), "base64")).toString();

test("builds every canvas into a manifest whose modules frames can load", async () => {
  const root = project();
  const { built, manifest } = await buildCanvases({ root });
  const out = resolveOut(root);

  expect(built).toBe(true);
  expect(readFileSync(join(out, ".gitignore"), "utf8")).toBe("*\n");
  expect(manifest.canvases.map(({ id, group, name, preview }) => ({ id, group, name, preview }))).toEqual([
    { id: "src/button.canvas.tsx", group: "Components", name: "Button", preview: ".canvas/preview.tsx" },
    { id: "src/card.canvas.tsx", group: "Layout", name: "Card", preview: ".canvas/preview.tsx" },
  ]);
  expect(manifest.canvases[0]!.frames).toEqual([
    { exportName: "Primary", name: "Primary", description: "The default action." },
    { exportName: "Loading", name: "Loading" },
  ]);
  expect(manifest.canvases[1]!.frames[0]!.fullscreen).toBe(true);

  const { frames } = manifest;
  for (const id of ["src/button.canvas.tsx", "src/card.canvas.tsx"]) {
    const source = frames.sources[id]!;
    expect(frames.modules[source.script]).toBeDefined();
    expect(frames.modules[source.project!]).toBeDefined();
  }
  for (const module of Object.values(frames.modules)) expect(existsSync(join(out, module.file))).toBe(true);
  // Chunks reference each other by the names frames map to blob URLs.
  const entry = moduleCode(out, frames.modules[frames.entry]!.file);
  expect(entry).toContain("canvas-preview:");
  expect(entry).not.toMatch(/["']\.\/chunk-/);
  // A frame loads only the styles of its own canvas.
  const buttonStyles = frames.modules[frames.sources["src/button.canvas.tsx"]!.script]!.css ?? [];
  expect(buttonStyles.map((name) => moduleCode(out, frames.modules[name]!.file)).join("")).toContain(".button");
  expect(frames.modules[frames.sources["src/card.canvas.tsx"]!.script]!.css).toBeUndefined();
  expect(frames.modules[frames.entry]!.css).toBeUndefined();
  expect(Object.keys(manifest.inputs)).toContain("src/button.tsx");
});

test("a build with no changed input is skipped", async () => {
  const root = project();
  const first = await buildCanvases({ root });
  expect((await buildCanvases({ root })).built).toBe(false);

  const later = new Date(Date.now() + 5_000);
  utimesSync(join(root, "src/card.tsx"), later, later);
  const rebuilt = await buildCanvases({ root });
  expect(rebuilt.built).toBe(true);
  expect(rebuilt.manifest.builtAt).not.toBe(first.manifest.builtAt);
});

test("a canvas with a broken import fails alone", async () => {
  const root = project({
    ...sampleProject,
    "src/missing.canvas.tsx": `import { Chart } from "missing-chart-package";\nexport const Default = () => <Chart />;\n`,
    "src/shared-broken.tsx": `export { Gauge } from "./not-there";\n`,
    "src/gauge.canvas.tsx": `import { Gauge } from "./shared-broken";\nexport const Default = () => <Gauge />;\n`,
  });
  const { manifest } = await buildCanvases({ root });
  const errors = Object.fromEntries(manifest.canvases.map((canvas) => [canvas.id, canvas.error]));

  expect(errors["src/missing.canvas.tsx"]).toContain("missing-chart-package");
  expect(errors["src/gauge.canvas.tsx"]).toContain("not-there");
  expect(errors["src/button.canvas.tsx"]).toBeUndefined();
  expect(Object.keys(manifest.frames.sources).sort()).toEqual(["src/button.canvas.tsx", "src/card.canvas.tsx"]);

  // Fixing the shared file is an input change, so the next build picks it up.
  writeProjectFiles(root, { "src/shared-broken.tsx": "export const Gauge = () => <meter />;\n" });
  const fixed = await buildCanvases({ root });
  expect(fixed.built).toBe(true);
  expect(fixed.manifest.canvases.find((canvas) => canvas.id === "src/gauge.canvas.tsx")?.error).toBeUndefined();
});

test("canvas code imports the same @pstdio/canvas as the frame runtime", async () => {
  // A project's own copy would give nested frames a loader the runtime never installs.
  const root = project({
    ...sampleProject,
    "node_modules/@pstdio/canvas/package.json": `{ "name": "@pstdio/canvas", "main": "index.ts" }\n`,
    "node_modules/@pstdio/canvas/index.ts": `export const projectCopy = "project copy";\n`,
    "src/nested.canvas.tsx": `import { frameBootstrap } from "@pstdio/canvas";\nexport const Default = () => <button onClick={() => void frameBootstrap("x")}>Load</button>;\n`,
  });
  const { manifest } = await buildCanvases({ root });
  const out = resolveOut(root);

  expect(manifest.canvases.find((canvas) => canvas.id === "src/nested.canvas.tsx")?.error).toBeUndefined();
  const code = Object.values(manifest.frames.modules).map((module) => moduleCode(out, module.file));
  expect(code.some((text) => text.includes("project copy"))).toBe(false);
});
