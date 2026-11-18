import { expect, test } from "bun:test";
import { dirname, resolve } from "node:path";

const moduleInputs = async (entry: string) => {
  const result = await Bun.build({
    entrypoints: [resolve(import.meta.dirname, entry)],
    target: "browser",
    packages: "external",
    metafile: true,
    plugins: [
      {
        name: "source-style-assets",
        setup(build) {
          build.onResolve({ filter: /\?raw$/ }, ({ path, importer }) => ({
            path: resolve(dirname(importer), path.slice(0, -4)),
            namespace: "raw-text",
          }));
          build.onLoad({ filter: /.*/, namespace: "raw-text" }, async ({ path }) => ({
            contents: await Bun.file(path).text(),
            loader: "text",
          }));
          build.onResolve({ filter: /\.css$/ }, ({ path }) => ({ path, external: true }));
        },
      },
    ],
  });
  expect(result.success).toBe(true);
  return result.metafile!.inputs;
};

test("root UI consumers load the shared theme without optional canvas or timeline modules", async () => {
  const inputs = Object.keys(await moduleInputs("src/index.ts"));
  expect(inputs.some((path) => path.endsWith("src/theme/theme.ts"))).toBe(true);
  expect(inputs.filter((path) => /\/(canvas|dependency-timeline)(\/|\.ts)/.test(path))).toEqual([]);
});

test("the dedicated canvas entry loads navigation without the dependency timeline", async () => {
  const inputs = Object.keys(await moduleInputs("src/components/canvas/index.ts"));
  expect(inputs.some((path) => path.endsWith("canvas/canvas-interactions.ts"))).toBe(true);
  expect(inputs.some((path) => path.includes("dependency-timeline/"))).toBe(false);
});

test("the dedicated timeline entry uses the same canvas navigation", async () => {
  const inputs = Object.keys(await moduleInputs("src/components/dependency-timeline/index.ts"));
  expect(inputs.some((path) => path.endsWith("dependency-timeline/dependency-timeline.tsx"))).toBe(true);
  expect(inputs.some((path) => path.endsWith("canvas/canvas-interactions.ts"))).toBe(true);
});

test("collection commands can evaluate saved view filters without loading renderers", async () => {
  const metadata = await moduleInputs("src/components/collection-view/model.ts");
  const inputs = Object.keys(metadata);
  const external = Object.values(metadata).flatMap((input) => input.imports.filter((entry) => entry.external));
  expect(new Set(external.map((entry) => entry.path))).toEqual(new Set(["@pstdio/sdk/extensions"]));
  expect(inputs.some((path) => path.endsWith("collection-view-filter.ts"))).toBe(true);
  expect(inputs.some((path) => path.endsWith("collection-view-fields.ts"))).toBe(true);
  expect(inputs.filter((path) => path.endsWith(".tsx"))).toEqual([]);
});
