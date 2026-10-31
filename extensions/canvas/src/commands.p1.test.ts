import { expect, test } from "bun:test";
import { commands } from "./commands";
import { testContext, testManifest } from "./test-build";

const foundations = "src/foundations.canvas.tsx";

test("resolves canvas resource names from the project's build", async () => {
  const { ctx } = await testContext();
  ctx.resource = { type: "canvas", id: foundations, label: "Previous name" };
  expect(await commands.resolve.run(ctx, {})).toMatchObject({
    type: "canvas",
    id: foundations,
    label: "Foundations",
    projectId: ctx.projectId,
    extensionId: "pstdio.canvas",
  });
});

test("reads a canvas with one frame per export and reports the build's state", async () => {
  const { ctx } = await testContext();
  const read = await commands["canvas.read"].run(ctx, { canvas: foundations });
  expect(read.status).toBe("ready");
  expect(read.canvas?.items.map((item) => [item.id, item.preview.defaultTheme])).toEqual([
    ["Colors", undefined],
    ["Typography", "pstdio-dark"],
    ["Spacing", undefined],
  ]);
  expect((await commands["canvas.read"].run(ctx, { canvas: "src/chart.canvas.tsx" })).canvas?.error).toContain(
    "missing-chart",
  );
  expect((await commands["canvas.read"].run((await testContext(null)).ctx, {})).status).toBe("missing");
  expect(
    (await commands["canvas.read"].run((await testContext({ ...testManifest(), canvases: [] })).ctx, {})).status,
  ).toBe("empty");
  const future = { ...testManifest(), format: 2 } as unknown as ReturnType<typeof testManifest>;
  expect((await commands["canvas.read"].run((await testContext(future)).ctx, {})).status).toBe("unsupported");
});

test("only the changed canvas gets a new revision", async () => {
  const before = testManifest();
  const after = testManifest();
  after.frames.modules["foundations-2.js"] = { file: "modules/f2.txt", imports: [], dynamicImports: [], bytes: 1 };
  after.frames.sources["src/foundations.canvas.tsx"] = { script: "foundations-2.js" };
  after.frames.modules["runtime-2.js"] = { file: "modules/r2.txt", imports: [], dynamicImports: [], bytes: 1 };
  after.frames.entry = "runtime-2.js";
  const revision = async (manifest: ReturnType<typeof testManifest>, canvas: string) =>
    (await commands["canvas.read"].run((await testContext(manifest)).ctx, { canvas })).canvas?.items[0]?.preview
      .revision;
  expect(await revision(after, foundations)).not.toBe(await revision(before, foundations));
  expect(await revision(after, "src/folder-picker.canvas.tsx")).toBe(
    await revision(before, "src/folder-picker.canvas.tsx"),
  );
});

test("serves a frame's modules from the build folder", async () => {
  const { ctx, files } = await testContext();
  await files.writeText("modules/runtime.txt", "runtime");
  await files.writeText("modules/foundations.txt", "foundations");
  const assets = await commands["preview.assets"].run(ctx, { source: foundations, cached: ["runtime.js"] });
  expect(assets).toMatchObject({ entry: "runtime.js", files: { "foundations.js": "foundations" } });
});

test("keeps independent frame positions through concurrent command edits", async () => {
  const { ctx } = await testContext();
  await Promise.all([
    commands["layout.update"].run(ctx, { canvas: foundations, change: { positions: { Colors: { x: 500, y: 20 } } } }),
    commands["layout.update"].run(ctx, {
      canvas: foundations,
      change: { positions: { Typography: { x: 900, y: 30 } } },
    }),
  ]);
  const layout = await commands["layout.read"].run(ctx, { canvas: foundations });
  expect(layout.positions.Colors).toEqual({ x: 500, y: 20 });
  expect(layout.positions.Typography).toEqual({ x: 900, y: 30 });
});

test("saves only positions of built frames and bounded camera values", async () => {
  const { ctx } = await testContext();
  await commands["layout.update"].run(ctx, {
    canvas: foundations,
    change: {
      camera: { x: 1e12, y: 0, zoom: 99 },
      positions: { Colors: { x: -25, y: 30 }, unknown: { x: 20, y: 30 } },
    },
  });
  const layout = await commands["layout.read"].run(ctx, { canvas: foundations });
  expect(layout.camera).toEqual({ x: 1000000, y: 0, zoom: 4 });
  expect(Object.keys(layout.positions)).toEqual(["Colors", "Typography", "Spacing"]);
  expect(layout.positions.Colors).toEqual({ x: -25, y: 30 });
});

test("lists project-owned links that resolve to the named canvas", async () => {
  const { parsePageUrl, qualifyRef } = await import("@pstdio/sdk/extensions");
  const { canvasPage } = await import("./navigation");
  const { ctx } = await testContext();
  const result = await commands.list.run(ctx, {});
  expect(result.status).toBe("ready");
  const canvas = result.canvases.find((item) => item.id === foundations)!;
  const link = parsePageUrl({
    projectId: ctx.projectId,
    url: canvas.href,
    pages: [{ ...canvasPage, ref: qualifyRef("pstdio.canvas", canvasPage.ref) }],
  });
  expect(link?.resource).toMatchObject({ type: "canvas", id: foundations, extensionId: "pstdio.canvas" });
  expect(result.canvases.find((item) => item.id === "src/chart.canvas.tsx")?.error).toContain("missing-chart");
});

test("keeps frame themes independent through concurrent edits", async () => {
  const { ctx } = await testContext();
  await Promise.all([
    commands["layout.update"].run(ctx, { canvas: foundations, change: { themes: { Colors: "pstdio-dark" } } }),
    commands["layout.update"].run(ctx, {
      canvas: foundations,
      change: { themes: { Typography: "solarized-light", unknown: "dracula" } },
    }),
  ]);
  const read = await commands["layout.read"].run(ctx, { canvas: foundations });
  expect(read.themes).toEqual({ Colors: "pstdio-dark", Typography: "solarized-light" });
});
