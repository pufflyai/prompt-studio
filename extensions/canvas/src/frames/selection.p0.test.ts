import { expect, test } from "bun:test";
import type { FrameBootstrap } from "./assets";
import { selectFrameBootstrap } from "./selection";

const fixture = (): FrameBootstrap => ({
  entry: "canvas-preview:entry.js",
  scripts: Object.fromEntries(
    ["entry.js", "base.js", "a.js", "b.js", "c.js", "provider.js", "prism.js"].map((name) => [name, new Blob([name])]),
  ),
  styles: [new Blob(["unrelated"]), new Blob(["theme"]), new Blob(["example"])],
  graph: {
    entry: "entry.js",
    catalog: "entry.js",
    sources: { a: { script: "a.js", project: "provider.js" }, b: { script: "b.js" }, c: { script: "c.js" } },
    modules: {
      "entry.js": {
        imports: ["base.js"],
        dynamicImports: ["a.js", "b.js", "c.js", "provider.js", "prism.js"],
        styles: [1],
      },
      "base.js": { imports: [], dynamicImports: [], styles: [] },
      "a.js": { imports: ["entry.js"], dynamicImports: ["c.js"], styles: [2] },
      "b.js": { imports: [], dynamicImports: [], styles: [0] },
      "c.js": { imports: ["base.js"], dynamicImports: [], styles: [] },
      "provider.js": { imports: [], dynamicImports: [], styles: [] },
      "prism.js": { imports: [], dynamicImports: [], styles: [] },
    },
  },
});

test("a frame retains its provider and lazy dependencies without starting unrelated catalog assets", async () => {
  const all = fixture();
  const selected = selectFrameBootstrap(all, "a");
  expect(Object.keys(selected.scripts).sort()).toEqual([
    "a.js",
    "base.js",
    "c.js",
    "entry.js",
    "prism.js",
    "provider.js",
  ]);
  expect(await Promise.all(selected.styles.map((style) => style.text()))).toEqual(["theme", "example"]);
  expect(selected.scripts["a.js"]).toBe(all.scripts["a.js"]);
  expect(Object.keys(all.scripts)).toContain("b.js");
  expect(selectFrameBootstrap(all, "b").scripts["b.js"]).toBe(all.scripts["b.js"]);
});

test("an unknown preview source reports a visible loading failure", () => {
  expect(() => selectFrameBootstrap(fixture(), "missing")).toThrow("Missing preview source");
});
