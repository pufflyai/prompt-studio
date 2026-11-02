import { afterEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { type CanvasBuildManifest, DEFAULT_OUT } from "@pstdio/canvas";
import { toCanvas } from "./canvas-model";

// A real build by the released `pstdio-canvas`: Button has its own stylesheet, Card has none.
const files: Record<string, string> = {
  "package.json": `{ "name": "revision-project", "private": true }\n`,
  "src/button.css": ".button { color: rebeccapurple; }\n",
  "src/button.tsx": `import "./button.css";\nexport const Button = () => <button className="button">Save</button>;\n`,
  "src/button.canvas.tsx": `import { Button } from "./button";\nexport const Primary = () => <Button />;\n`,
  "src/card.tsx": "export const Card = () => <section>Usage</section>;\n",
  "src/card.canvas.tsx": `import { Card } from "./card";\nexport const Default = () => <Card />;\n`,
};
const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});
const write = (root: string, changes: Record<string, string>) => {
  for (const [path, content] of Object.entries(changes)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
};
const build = (root: string) => {
  const command = Bun.spawnSync(
    [
      process.execPath,
      join(import.meta.dir, "../node_modules/@pstdio/canvas/bin/pstdio-canvas.ts"),
      "build",
      "--root",
      root,
    ],
    { stderr: "pipe" },
  );
  if (command.exitCode) throw new Error(command.stderr.toString());
  const manifest = JSON.parse(readFileSync(join(root, DEFAULT_OUT, "manifest.json"), "utf8")) as CanvasBuildManifest;
  return Object.fromEntries(
    manifest.canvases.map((entry) => [entry.id, toCanvas(manifest, entry).items[0]!.preview.revision]),
  );
};

test("a style-only edit gives only that canvas a new revision, so only its frames reload", () => {
  const root = mkdtempSync(join(tmpdir(), "canvas-revision-"));
  roots.push(root);
  write(root, files);
  mkdirSync(join(root, "node_modules"));
  for (const name of ["react", "react-dom"])
    symlinkSync(join(import.meta.dir, "../node_modules", name), join(root, "node_modules", name), "dir");

  const before = build(root);
  write(root, { "src/button.css": ".button { color: tomato; }\n" });
  const after = build(root);

  expect(after["src/button.canvas.tsx"]).not.toBe(before["src/button.canvas.tsx"]);
  expect(after["src/card.canvas.tsx"]).toBe(before["src/card.canvas.tsx"]);
}, 15_000);
