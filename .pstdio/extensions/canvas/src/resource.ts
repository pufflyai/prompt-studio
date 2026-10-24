import { defineCommand, defineResourceKind } from "@pstdio/sdk/extensions";
import { canvases } from "./canvases/definitions";

export const resolveCanvasCommand = defineCommand({
  id: "resolve",
  title: "Resolve canvas",
  async run(ctx) {
    const canvas = canvases.find((entry) => entry.id === ctx.resource?.id);
    if (!canvas) return null;
    return {
      ...ctx.resource,
      type: "canvas",
      id: canvas.id,
      label: canvas.name,
      projectId: ctx.projectId,
      extensionId: "pstdio.canvas",
    };
  },
});
export const canvasResource = defineResourceKind({
  id: "canvas",
  label: "Canvas",
  icon: "layout-dashboard",
  resolve: resolveCanvasCommand.ref,
});
