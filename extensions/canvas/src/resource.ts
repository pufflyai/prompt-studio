import { defineCommand, defineResourceKind } from "@pstdio/sdk/extensions";
import { buildFiles, readBuild } from "./build-mount";

const canvasIcon = "diamond";

export const resolveCanvasCommand = defineCommand({
  id: "resolve",
  title: "Resolve canvas",
  async run(ctx) {
    const build = await readBuild(buildFiles(ctx));
    const canvas =
      build.status === "ready" ? build.manifest.canvases.find((entry) => entry.id === ctx.resource?.id) : undefined;
    if (!canvas) return null;
    return {
      ...ctx.resource,
      type: "canvas",
      id: canvas.id,
      label: canvas.name,
      icon: canvasIcon,
      projectId: ctx.projectId,
      extensionId: "pstdio.canvas",
    };
  },
});
export const canvasResource = defineResourceKind({
  id: "canvas",
  label: "Canvas",
  icon: canvasIcon,
  resolve: resolveCanvasCommand.ref,
});
