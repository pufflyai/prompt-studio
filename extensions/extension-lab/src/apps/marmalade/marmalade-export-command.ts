import { defineCommand, l10n, params } from "@pstdio/sdk/extensions";
import { marmaladeLayers } from "./marmalade-layers";
import { inMarmaladeOrder, readMarmaladeDocument } from "./marmalade-storage";
import { marmaladeSvg } from "./marmalade-svg";

export const exportMarmalade = defineCommand({
  id: "marmalade.export",
  title: l10n("commands.marmaladeExport", "Export Marmalade SVG"),
  cli: { path: ["marmalade", "export"] },
  params: { documentId: params.text({ required: true }) },
  run: (ctx, input) =>
    inMarmaladeOrder(ctx.projectId, async () => {
      if (
        ctx.resource &&
        (ctx.resource.type !== "marmalade.document" ||
          ctx.resource.id !== input.documentId ||
          (ctx.resource.extensionId && ctx.resource.extensionId !== ctx.extensionId) ||
          (ctx.resource.projectId && ctx.resource.projectId !== ctx.projectId))
      )
        throw new Error("This Marmalade document is not available in the current project.");
      const { state } = await readMarmaladeDocument(ctx.storage);
      if (state.document.id !== input.documentId) throw new Error("This Marmalade document is unavailable.");
      let imageHref = "";
      if (marmaladeLayers(state).some((layer) => layer.kind === "image")) {
        const bytes = await ctx.packageFiles.readBytes("assets/great-wave.jpg");
        imageHref = `data:image/jpeg;base64,${Buffer.from(bytes).toString("base64")}`;
      }
      ctx.signal.throwIfAborted();
      const name =
        [...state.document.title]
          .map((character) => (character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127 ? "-" : character))
          .join("")
          .replace(/[<>:"/\\|?*]/g, "-")
          .trim()
          .replace(/\s+/g, "-")
          .replace(/[. ]+$/, "")
          .toLowerCase() || "marmalade";
      return { fileName: `${name}.svg`, mimeType: "image/svg+xml", svg: marmaladeSvg(state, imageHref) };
    }),
});
