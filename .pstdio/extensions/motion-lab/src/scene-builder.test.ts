import { expect, test } from "bun:test";
import { buildScene } from "./scene-builder";

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
