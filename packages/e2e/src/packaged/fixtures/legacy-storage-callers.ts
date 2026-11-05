import { defineCommand, defineExtension } from "@pstdio/sdk/extensions";
import type { CanvasDefinition } from "../../../../../extensions/canvas/src/canvas-model";
import { loadLayout, saveLayout } from "../../../../../extensions/canvas/src/layout-store";
import { readExampleState, writeExampleState } from "../../../../../extensions/extension-lab/src/example-state";
import {
  readScribbleState,
  saveScribblePage,
} from "../../../../../extensions/extension-lab/src/scribble-pages-storage";

// Import production callers unchanged: this fixture qualifies the compatibility period,
// before those callers adopt the replacement ordered-record API in a separate release.
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
  title: "Read retained Canvas and Lab edits",
  async run(ctx) {
    return {
      layout: await loadLayout(ctx.storage, canvas),
      example: await readExampleState(ctx.storage, "boombox"),
      scribble: await readScribbleState(ctx.storage),
    };
  },
});
const write = defineCommand({
  id: "write",
  title: "Save retained Canvas and Lab edits",
  mutating: true,
  async run(ctx) {
    await ctx.storage.collection("examples:boombox").set("legacy-filter", {
      path: ["filter"],
      value: "Favorites",
    });
    await ctx.storage.collection("examples:scribble").set("legacy-title", {
      path: ["documents", 0, "title"],
      value: "Migrated page",
    });
    const migrated = await readScribbleState(ctx.storage);
    await writeExampleState(ctx.storage, "boombox", [{ path: ["query"], value: "Saved search" }]);
    await saveLayout(ctx.storage, canvas, {
      camera: { x: 72, y: -30, zoom: 1.5 },
      positions: { first: { x: 120, y: 80 } },
      themes: { first: "app" },
    });
    await saveLayout(ctx.storage, canvas, {
      positions: { second: { x: 900, y: 100 } },
      themes: { second: "dark" },
    });
    await saveScribblePage(ctx.storage, "north-star", "Saved page", "Document", "Existing page content");
    await saveScribblePage(ctx.storage, "new-page", "New page", "Document", "New page content");
    return { migrated };
  },
});
const update = defineCommand({
  id: "update",
  title: "Continue editing after restart",
  mutating: true,
  async run(ctx) {
    await writeExampleState(ctx.storage, "boombox", [{ path: ["playing"], value: false }]);
    await saveLayout(ctx.storage, canvas, { positions: { first: { x: 240, y: 160 } } });
    await saveScribblePage(ctx.storage, "new-page", "Later page", "Document", "Later content");
  },
});
export default defineExtension({ commands: [read, write, update] });
