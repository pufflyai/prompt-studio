import { expect, test } from "bun:test";
import { copyFile, cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildScene } from "./scene-builder";

test("builds React scenes without resolving unused shared libraries", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "motion-scene-react-"));
  try {
    for (const name of ["scene-builder.ts", "shared-exports.ts", "shared-imports.ts"]) {
      await copyFile(new URL(`./${name}`, import.meta.url), join(cwd, name));
    }
    await cp(fileURLToPath(new URL(".", import.meta.resolve("react"))), join(cwd, "node_modules/react"), {
      recursive: true,
    });
    const files = {
      "scene.tsx": 'export { default } from "./content";',
      "content.tsx":
        'import {useState} from "react"; export default function Scene(){ return <div>{useState("Ready")[0]}</div> }',
      "unused.tsx": 'import {AbsoluteFill} from "remotion"; export default AbsoluteFill;',
    };
    const child = Bun.spawn(
      [
        process.execPath,
        "--eval",
        `import { buildScene } from "./scene-builder.ts"; console.log(JSON.stringify(await buildScene(${JSON.stringify(files)})));`,
      ],
      { cwd, stdout: "pipe", stderr: "pipe" },
    );
    const [stdout, stderr, code] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
    expect(code, stderr).toBe(0);
    expect(JSON.parse(stdout)).toMatchObject({ code: expect.stringContaining("Ready") });
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("builds a scene against shared React and bundles local helpers", async () => {
  const result = await buildScene({
    "scene.tsx":
      'import {useState} from "react"; import {label} from "./label"; export default function Scene(){ return <div>{useState(label)[0]}</div> }',
    "label.ts": 'export const label="Ready";',
  });
  expect(result).toHaveProperty("code");
  if ("code" in result) {
    expect(result.code).toContain("__motionLabShared");
    expect(result.code).toContain("Ready");
    expect(result.code).not.toContain("react.development");
  }
});

test("builds a scene using a shared browser library from a local helper", async () => {
  const result = await buildScene({
    "scene.tsx": 'export { Scene as default } from "./content";',
    "content.tsx":
      'import {AbsoluteFill} from "remotion"; export function Scene(){ return <AbsoluteFill>Ready</AbsoluteFill> }',
  });
  expect(result).toMatchObject({ code: expect.stringContaining('__motionLabShared["remotion"]') });
});

test.each([
  "unavailable-library",
  "../outside",
  "https://example.com/code.js",
])("rejects imports outside the study: %s", async (path) => {
  const result = await buildScene({ "scene.tsx": `import thing from "${path}"; export default thing;` });
  expect(result).toHaveProperty("error");
});

test("reports syntax errors with their file and line", async () => {
  const result = await buildScene({ "scene.tsx": "export default function Scene() { return <div>" });
  expect(result).toMatchObject({ error: { file: expect.stringContaining("scene.tsx"), line: expect.any(Number) } });
});
