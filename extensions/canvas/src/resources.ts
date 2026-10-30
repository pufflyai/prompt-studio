import { defineCommandPaletteResource } from "@pstdio/sdk/extensions";
import { canvases } from "./canvases/definitions";
import { canvasResource, canvasTarget } from "./navigation";

export const canvasResources = defineCommandPaletteResource({
  id: "canvases",
  title: "UI Canvas",
  resourceKind: canvasResource.ref,
  query: async (ctx, input) => {
    const words = input.query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return {
      items: canvases
        .filter((canvas) => {
          const text =
            `${canvas.name} ${canvas.group ?? ""} ${canvas.path?.join(" ") ?? ""} ${canvas.keywords ?? ""} ${canvas.items
              .map(
                (item) =>
                  `${item.id} ${item.name} ${item.preview?.source ?? ""} ${item.variants?.map((variant) => `${variant.id} ${variant.name} ${variant.preview.exportName}`).join(" ") ?? ""}`,
              )
              .join(" ")}`.toLowerCase();
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
