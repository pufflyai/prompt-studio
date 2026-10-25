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
  return Object.keys(result.metafile!.inputs);
};

test("root UI consumers load the shared theme without optional canvas or timeline modules", async () => {
  const inputs = await moduleInputs("src/index.ts");
  expect(inputs.some((path) => path.endsWith("src/theme/theme.ts"))).toBe(true);
  expect(inputs.filter((path) => /\/(canvas|dependency-timeline)(\/|\.ts)/.test(path))).toEqual([]);
});

test("the dedicated canvas entry loads navigation without the dependency timeline", async () => {
  const inputs = await moduleInputs("src/components/canvas/index.ts");
  expect(inputs.some((path) => path.endsWith("canvas/canvas-interactions.ts"))).toBe(true);
  expect(inputs.some((path) => path.includes("dependency-timeline/"))).toBe(false);
});

test("the dedicated timeline entry uses the same canvas navigation", async () => {
  const inputs = await moduleInputs("src/components/dependency-timeline/index.ts");
  expect(inputs.some((path) => path.endsWith("dependency-timeline/dependency-timeline.tsx"))).toBe(true);
  expect(inputs.some((path) => path.endsWith("canvas/canvas-interactions.ts"))).toBe(true);
});

test("the published root entry does not load optional component code or styles", async () => {
  const result = await Bun.build({
    entrypoints: [resolve(import.meta.dirname, "dist/index.js")],
    target: "browser",
    packages: "external",
    metafile: true,
  });
  expect(result.success).toBe(true);
  const sources = (
    await Promise.all(
      Object.keys(result.metafile!.inputs).map(async (input) => {
        const map = Bun.file(resolve(import.meta.dirname, `${input}.map`));
        return (await map.exists()) ? ((await map.json()).sources as string[]) : [];
      }),
    )
  ).flat();
  expect(sources.length).toBeGreaterThan(0);
  expect(sources.filter((path) => /\/(canvas|dependency-timeline)(\/|\.ts)/.test(path))).toEqual([]);
});
