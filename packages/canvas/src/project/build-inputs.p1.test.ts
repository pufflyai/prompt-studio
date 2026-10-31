import { afterEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { gunzipSync } from "node:zlib";
import { buildCanvases, readManifest, resolveOut } from "./build";
import { createTestProject, sampleProject, writeProjectFiles } from "./test-project";

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
});
const project = (files: Record<string, string> = sampleProject) => {
  const created = createTestProject(files);
  cleanups.push(created.dispose);
  return created.root;
};
// Each command run is a new process, so a package installed in between is resolved afresh.
const CLI = resolve(import.meta.dir, "../../bin/pstdio-canvas.ts");
const commandBuild = async (root: string, canvas = "src/widget.canvas.tsx") => {
  const result = Bun.spawnSync([process.execPath, CLI, "build"], { cwd: root, stdout: "pipe", stderr: "pipe" });
  const manifest = (await readManifest(resolveOut(root)))!;
  return {
    built: result.stdout.toString().includes("Built "),
    widget: manifest.canvases.find((c) => c.id === canvas),
  };
};
const widget = (version: string, label: string) => ({
  "node_modules/local-widget/package.json": JSON.stringify({ name: "local-widget", version, main: "index.js" }),
  "node_modules/local-widget/index.js": `export const Widget = () => ${JSON.stringify(label)};\n`,
});

test("installing a missing package or upgrading it rebuilds the canvas", async () => {
  const root = project({
    ...sampleProject,
    "src/widget.canvas.tsx": `import { Widget } from "local-widget";\nexport const Default = () => <Widget />;\n`,
  });
  expect((await commandBuild(root)).widget?.error).toContain("local-widget");

  writeProjectFiles(root, widget("1.0.0", "first"));
  const installed = await commandBuild(root);
  expect(installed.built).toBe(true);
  expect(installed.widget?.error).toBeUndefined();
  expect((await commandBuild(root)).built).toBe(false);

  // An upgrade replaces the package's files, including its package.json.
  writeProjectFiles(root, widget("2.0.0", "second"));
  utimesSync(join(root, "node_modules/local-widget/package.json"), new Date(), new Date(Date.now() + 1_000));
  expect((await commandBuild(root)).built).toBe(true);
});

test("a change to a file outside the project, such as a sibling workspace package, rebuilds", async () => {
  const base = mkdtempSync(join(tmpdir(), "pstdio-canvas-workspace-"));
  cleanups.push(() => rmSync(base, { recursive: true, force: true }));
  const root = project({
    ...sampleProject,
    "src/shared.canvas.tsx": `import { Badge } from "${join(base, "shared/badge")}";\nexport const Default = () => <Badge />;\n`,
  });
  writeProjectFiles(base, { "shared/badge.tsx": "export const Badge = () => <span>New</span>;\n" });
  await buildCanvases({ root });
  expect((await buildCanvases({ root })).built).toBe(false);

  utimesSync(join(base, "shared/badge.tsx"), new Date(), new Date(Date.now() + 1_000));
  expect((await buildCanvases({ root })).built).toBe(true);
});

test("a root reached through a symbolic link builds", async () => {
  const root = project();
  const links = mkdtempSync(join(tmpdir(), "pstdio-canvas-link-"));
  cleanups.push(() => rmSync(links, { recursive: true, force: true }));
  mkdirSync(join(links, "nested"));
  symlinkSync(root, join(links, "nested", "project"), "dir");

  const { manifest } = await buildCanvases({ root: join(links, "nested", "project") });
  expect(manifest.canvases.every((canvas) => !canvas.error)).toBe(true);
  expect(Object.keys(manifest.frames.sources)).toEqual(["src/button.canvas.tsx", "src/card.canvas.tsx"]);
});

test("a file changed after the build started is rebuilt next time", async () => {
  const root = project();
  // The build cannot know whether it read this file before or after the change.
  const duringBuild = new Date(Date.now() + 60_000);
  utimesSync(join(root, "src/card.tsx"), duringBuild, duringBuild);
  await buildCanvases({ root });
  expect((await buildCanvases({ root })).built).toBe(true);
});

test("an import alias missing from tsconfig.json fails, and adding it rebuilds the canvas", async () => {
  const root = project({
    ...sampleProject,
    "src/aliased.canvas.tsx": `import { Card } from "@/card";\nexport const Default = () => <Card title="Aliased" />;\n`,
  });
  expect((await commandBuild(root, "src/aliased.canvas.tsx")).widget?.error).toContain("@/card");

  writeProjectFiles(root, { "tsconfig.json": JSON.stringify({ compilerOptions: { paths: { "@/*": ["./src/*"] } } }) });
  const fixed = await commandBuild(root, "src/aliased.canvas.tsx");
  expect(fixed.built).toBe(true);
  expect(fixed.widget?.error).toBeUndefined();
});

test("Vite-style ?raw and ?url imports build", async () => {
  const root = project({
    ...sampleProject,
    "src/notes.txt": "Plain notes",
    "src/pixel.png": "png-bytes",
    "src/query.canvas.tsx": `import notes from "./notes.txt?raw";\nimport pixel from "./pixel.png?url";\nexport const Default = () => <img alt={notes} src={pixel} />;\n`,
  });
  const { manifest } = await buildCanvases({ root });
  expect(manifest.canvases.find((canvas) => canvas.id === "src/query.canvas.tsx")?.error).toBeUndefined();
  const script = manifest.frames.modules[manifest.frames.sources["src/query.canvas.tsx"]!.script]!;
  const code = gunzipSync(Buffer.from(readFileSync(join(resolveOut(root), script.file), "utf8"), "base64")).toString();
  // `?raw` is the file's text; `?url` is an address a sandboxed frame can load without the project.
  expect(code).toContain(JSON.stringify("Plain notes"));
  expect(code).toContain(`data:image/png;base64,${Buffer.from("png-bytes").toString("base64")}`);
});
