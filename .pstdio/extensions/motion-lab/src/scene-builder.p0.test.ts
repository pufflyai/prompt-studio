import { expect, test } from "bun:test";
import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildScene } from "./scene-builder";

test("builds scenes that use shared libraries without reading installed packages", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "motion-scene-"));
  try {
    await cp(fileURLToPath(new URL(".", import.meta.url)), cwd, { recursive: true });
    const files = {
      "scene.tsx":
        'import { Box } from "@chakra-ui/react"; import { AbsoluteFill } from "remotion"; import { WorkbenchFrame } from "motion-lab/kit"; export default function Scene(){ return <AbsoluteFill><WorkbenchFrame><Box>Ready</Box></WorkbenchFrame></AbsoluteFill> }',
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
    expect(result.code).toContain('"motion-lab-shared:react"');
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
  expect(result).toMatchObject({ code: expect.stringContaining('"motion-lab-shared:remotion"') });
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
