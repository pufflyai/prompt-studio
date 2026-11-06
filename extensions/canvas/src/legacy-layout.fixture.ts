import { defineCommand, defineExtension } from "@pstdio/sdk/extensions";
import type { CanvasDefinition } from "./canvas-model";
import { loadLayout, saveLayout } from "./layout-store";

// The packaged host loads this test extension with the production caller unchanged.
const canvas: CanvasDefinition = {
  id: "compatibility",
  name: "Compatibility",
  group: "",
  items: ["first", "second"].map((id, index) => ({
    id,
    name: id,
    position: { x: index * 640, y: 0 },
    width: 640,
    height: 240,
    preview: { source: "compatibility", exportName: id, viewportHeight: 240, revision: "1" },
  })),
};
const read = defineCommand({
  id: "read",
  title: "Read retained layout",
  run: (ctx) => loadLayout(ctx.storage, canvas),
});
const write = defineCommand({
  id: "write",
  title: "Save retained layout",
  mutating: true,
  async run(ctx) {
    await saveLayout(ctx.storage, canvas, {
      camera: { x: 72, y: -30, zoom: 1.5 },
      positions: { first: { x: 120, y: 80 } },
      themes: { first: "app" },
    });
    await saveLayout(ctx.storage, canvas, {
      positions: { second: { x: 900, y: 100 } },
      themes: { second: "dark" },
    });
  },
});
const update = defineCommand({
  id: "update",
  title: "Continue layout edits after restart",
  mutating: true,
  run: (ctx) => saveLayout(ctx.storage, canvas, { positions: { first: { x: 240, y: 160 } } }),
});
export default defineExtension({ commands: [read, write, update] });
