import { expect, test } from "bun:test";
import type { FrameManifest } from "@pstdio/canvas";
import { readFrameAssets, selectFrameModules } from "./module-graph";

const module = (name: string, imports: string[] = [], dynamicImports: string[] = []) => ({
  file: `modules/${name}.txt`,
  imports,
  dynamicImports,
  bytes: 10,
});
const manifest: FrameManifest = {
  entry: "runtime.js",
  catalog: "runtime.js",
  sources: { button: { script: "button.js", project: "provider.js" }, editor: { script: "editor.js" } },
  modules: {
    "runtime.js": { ...module("runtime", ["react.js"], ["button.js", "editor.js"]), css: ["theme.css"] },
    "react.js": module("react"),
    "button.js": module("button", ["react.js"], ["dialog.js"]),
    "dialog.js": module("dialog", ["react.js"]),
    "provider.js": module("provider", ["react.js"]),
    "editor.js": module("editor"),
    "theme.css": module("theme"),
  },
  styles: ["theme.css"],
};

test("a frame receives its runtime, provider and reachable interactions without unrelated examples", () => {
  expect(selectFrameModules(manifest, "button")).toEqual([
    "runtime.js",
    "react.js",
    "button.js",
    "dialog.js",
    "provider.js",
  ]);
  expect(selectFrameModules(manifest, "$runtime")).toEqual(["runtime.js", "react.js"]);
});

test("a preview loads only its dependency styles in catalog cascade order", async () => {
  const graph = {
    ...manifest,
    styles: ["dialog.css", "theme.css", "editor.css"],
    modules: {
      ...manifest.modules,
      "dialog.js": { ...module("dialog", ["react.js"]), css: ["dialog.css"] },
      "editor.js": { ...module("editor"), css: ["editor.css"] },
      "dialog.css": module("dialog-style"),
      "editor.css": module("editor-style"),
    },
  };
  const assets = await readFrameAssets(graph, { source: "button", cached: [] }, async (path) => path);
  expect(assets.styles).toEqual(["dialog.css", "theme.css"]);
  expect(Object.keys(assets.files)).not.toContain("editor.css");
});

test("immutable files already cached by the viewer are not read or sent again", async () => {
  const reads: string[] = [];
  const result = await readFrameAssets(
    manifest,
    { source: "button", cached: ["runtime.js", "react.js", "theme.css"] },
    async (file) => {
      reads.push(file);
      return `gzip:${file}`;
    },
  );
  expect(Object.keys(result.files)).toEqual(["button.js", "dialog.js", "provider.js"]);
  expect(reads).toHaveLength(3);
  expect(result.modules).toContain("react.js");
  expect(result.styles).toEqual(["theme.css"]);
});

test("asset requests cannot read paths outside the compiled catalog", async () => {
  const reads: string[] = [];
  await expect(
    readFrameAssets(manifest, { source: "../../secret", cached: [] }, async (path) => {
      reads.push(path);
      return "";
    }),
  ).rejects.toThrow("Missing preview source");
  expect(reads).toEqual([]);
});

test("shared chunks retain lazily imported interactions when reached by a selected example", () => {
  const graph = {
    ...manifest,
    modules: { ...manifest.modules, "react.js": module("react", [], ["dialog.js"]) },
  };
  expect(selectFrameModules(graph, "button")).toContain("dialog.js");
  expect(selectFrameModules(graph, "$runtime")).not.toContain("dialog.js");
});

test("the catalog lookup table is excluded without discarding other runtime lazy dependencies", () => {
  const graph = {
    ...manifest,
    catalog: "catalog.js",
    modules: {
      ...manifest.modules,
      "catalog.js": module("catalog", [], ["button.js", "editor.js"]),
      "runtime.js": module("runtime", ["react.js", "catalog.js"], ["dialog.js"]),
      "button.js": module("button", ["runtime.js"]),
    },
  };
  const files = selectFrameModules(graph, "button");
  expect(files).toContain("dialog.js");
  expect(files).not.toContain("editor.js");
});
