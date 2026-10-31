import { defineCommandPaletteResource } from "@pstdio/sdk/extensions";
import { buildFiles, readBuild } from "./build-mount";
import { canvasResource, canvasTarget } from "./navigation";

export const canvasResources = defineCommandPaletteResource({
  id: "canvases",
  title: "UI Canvas",
  resourceKind: canvasResource.ref,
  query: async (ctx, input) => {
    const build = await readBuild(buildFiles(ctx));
    const canvases = build.status === "ready" ? build.manifest.canvases : [];
    const words = input.query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return {
      items: canvases
        .filter((canvas) => {
          const frames = canvas.frames.map((frame) => `${frame.name} ${frame.exportName}`).join(" ");
          const text = `${canvas.title} ${canvas.id} ${frames}`.toLowerCase();
          return words.every((word) => text.includes(word));
        })
        .slice(0, input.limit)
        .map((canvas) => ({
          id: canvas.id,
          label: canvas.name,
          icon: canvasResource.icon,
          target: canvasTarget(canvas.id, canvas.name, ctx.projectId),
        })),
    };
  },
});
