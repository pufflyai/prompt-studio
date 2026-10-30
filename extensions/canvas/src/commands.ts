import { defineCommand, params } from "@pstdio/sdk/extensions";
import { canvases, findCanvas } from "./canvases/definitions";
import { layoutChanged } from "./events";
import { loadLayout, saveLayout } from "./layout-store";
import { canvasTarget, canvasUrl } from "./navigation";
import { resolveCanvasCommand } from "./resource";

const canvasParam = { canvas: params.text({ required: true, label: "Canvas id" }) };
export const commands = {
  resolve: resolveCanvasCommand,
  list: defineCommand({
    id: "list",
    title: "List canvases",
    cli: true,
    async run(ctx) {
      return {
        canvases: canvases.map(({ id, name, group, items }) => ({
          id,
          name,
          group,
          previewCount: items.length,
          href: canvasUrl(ctx.projectId, id),
        })),
      };
    },
  }),
  open: defineCommand({
    id: "open",
    title: "Open canvas",
    cli: true,
    params: canvasParam,
    async run(ctx, input) {
      const canvas = findCanvas(input.canvas);
      const target = canvasTarget(canvas.id, canvas.name, ctx.projectId);
      await ctx.navigation.open(target);
      return { target, href: canvasUrl(ctx.projectId, canvas.id) };
    },
  }),
  "layout.read": defineCommand({
    id: "layout.read",
    title: "Read canvas layout",
    cli: true,
    params: canvasParam,
    async run(ctx, input) {
      const canvas = findCanvas(input.canvas);
      return loadLayout(ctx.storage, canvas);
    },
  }),
  "layout.update": defineCommand({
    id: "layout.update",
    title: "Update canvas layout",
    cli: true,
    mutating: true,
    params: { ...canvasParam, change: params.json({ required: true, label: "Camera, positions, or frame themes" }) },
    async run(ctx, input) {
      const canvas = findCanvas(input.canvas);
      const next = await saveLayout(ctx.storage, canvas, input.change);
      await ctx.events.emit(layoutChanged, { canvas: canvas.id });
      return next;
    },
  }),
};
