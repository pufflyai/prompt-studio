import { expect, test } from "bun:test";
import { createMemoryStorage, makeCommandContext } from "@pstdio/sdk/testing";
import { canvases } from "./canvases/definitions";
import { commands } from "./commands";

test("resolves canvas resource names from the source registry", async () => {
  const canvas = canvases[0];
  const ctx = makeCommandContext({
    storage: createMemoryStorage(),
    params: {},
    overrides: { resource: { type: "canvas", id: canvas.id, label: "Previous name" } },
  });
  const resource = await commands.resolve.run(ctx, {});
  expect(resource).toMatchObject({
    type: "canvas",
    id: canvas.id,
    label: canvas.name,
    projectId: ctx.projectId,
    extensionId: "pstdio.canvas",
  });
});

test("keeps independent canvas positions through concurrent command edits", async () => {
  const storage = createMemoryStorage();
  const ctx = makeCommandContext({ storage, params: {} });
  await Promise.all([
    commands["layout.update"].run(ctx, {
      canvas: "playground",
      change: { positions: { "project-form": { x: 500, y: 20 } } },
    }),
    commands["layout.update"].run(ctx, {
      canvas: "playground",
      change: { positions: { controls: { x: 900, y: 30 } } },
    }),
  ]);
  const layout = await commands["layout.read"].run(ctx, { canvas: "playground" });
  expect(layout.positions["project-form"]).toEqual({ x: 500, y: 20 });
  expect(layout.positions.controls).toEqual({ x: 900, y: 30 });
});
test("saves only source-backed positions and bounded camera values", async () => {
  const storage = createMemoryStorage();
  const ctx = makeCommandContext({ storage, params: {} });
  await commands["layout.update"].run(ctx, {
    canvas: "playground",
    change: {
      camera: { x: 1e12, y: 0, zoom: 99 },
      positions: { "project-form": { x: -25, y: 30 }, unknown: { x: 20, y: 30 } },
      names: { "project-form": "Outdated name" },
      hidden: ["controls"],
      drafts: { password: "never save" },
    },
  });
  expect(await commands["layout.read"].run(ctx, { canvas: "playground" })).toEqual({
    version: 1,
    themes: {},
    camera: { x: 1000000, y: 0, zoom: 4 },
    positions: { "project-form": { x: -25, y: 30 }, controls: { x: 440, y: 0 } },
  });
});

test("lists project-owned links that resolve to the named canvas", async () => {
  const { parsePageUrl, qualifyRef } = await import("@pstdio/sdk/extensions");
  const { canvasPage } = await import("./navigation");
  const ctx = makeCommandContext({ storage: createMemoryStorage(), params: {} });
  const result = await commands.list.run(ctx, {});
  const canvas = result.canvases.find((item) => item.id === "foundations")!;
  expect(canvas.href).toBeString();
  const link = parsePageUrl({
    projectId: ctx.projectId,
    url: canvas.href,
    pages: [{ ...canvasPage, ref: qualifyRef("pstdio.canvas", canvasPage.ref) }],
  });
  expect(link?.resource).toMatchObject({
    type: "canvas",
    id: "foundations",
    projectId: ctx.projectId,
    extensionId: "pstdio.canvas",
  });
});

test("keeps frame themes independent through concurrent edits and ignores unsupported choices", async () => {
  const ctx = makeCommandContext({ storage: createMemoryStorage(), params: {} });
  await Promise.all([
    commands["layout.update"].run(ctx, { canvas: "playground", change: { themes: { "project-form": "pstdio-dark" } } }),
    commands["layout.update"].run(ctx, {
      canvas: "playground",
      change: { themes: { controls: "solarized-light", unknown: "dracula" } },
    }),
  ]);
  const read = () => commands["layout.read"].run(ctx, { canvas: "playground" });
  expect((await read()).themes).toEqual({ "project-form": "pstdio-dark", controls: "solarized-light" });
  await commands["layout.update"].run(ctx, { canvas: "playground", change: { themes: { controls: "unsupported" } } });
  expect((await read()).themes.controls).toBe("solarized-light");
});
