import { defineCommand, l10n, params } from "@pstdio/sdk/extensions";
import { buildFiles, readBuild } from "./build-mount";
import { findCanvas, toCanvas } from "./canvas-model";
import { layoutChanged } from "./events";
import { readFrameAssets } from "./frames/module-graph";
import { loadLayout, saveLayout } from "./layout-store";
import { canvasTarget, canvasUrl } from "./navigation";
import { parameterCommands } from "./parameters/commands";
import { motionCommands } from "./motion/review-commands";
import { shaderCommands } from "./shaders/commands";
import { resolveCanvasCommand } from "./resource";

const canvasParam = { canvas: params.text({ required: true, label: "Canvas file" }) };

const readCanvas = async (ctx: Parameters<typeof buildFiles>[0], id: string) => {
  const build = await readBuild(buildFiles(ctx));
  const canvas = build.status === "ready" ? findCanvas(build.manifest, id) : undefined;
  if (!canvas) throw new Error(`Canvas "${id}" does not exist. Run \`pstdio-canvas watch\` to build it.`);
  return canvas;
};

export const commands = {
  ...parameterCommands,
  ...motionCommands,
  ...shaderCommands,
  "preview.assets": defineCommand({
    id: "preview.assets",
    title: l10n("command.previewAssets", "Load preview assets"),
    params: {
      source: params.text({ required: true }),
      cached: params.json({ required: true }),
    },
    async run(ctx, input) {
      const files = buildFiles(ctx);
      const request = { source: input.source, cached: input.cached as string[] };
      const read = async (fresh: boolean) => {
        const build = await readBuild(files, { fresh });
        if (build.status !== "ready" || !files) throw new Error("The canvas build is not available");
        return readFrameAssets(build.manifest.frames, request, (path) => files.readText(path));
      };
      // A new build can replace modules between reading the manifest and reading them.
      return read(false).catch(() => read(true));
    },
  }),
  // The view reads one canvas, or the first one when none is chosen, with the build's state.
  "canvas.read": defineCommand({
    id: "canvas.read",
    title: l10n("command.readCanvas", "Read canvas"),
    params: { canvas: params.text({ label: "Canvas file" }) },
    async run(ctx, input) {
      const build = await readBuild(buildFiles(ctx));
      if (build.status !== "ready") return { status: build.status };
      const { manifest } = build;
      if (!manifest.canvases.length) return { status: "empty" as const };
      const entry = input.canvas
        ? manifest.canvases.find((canvas) => canvas.id === input.canvas)
        : manifest.canvases[0];
      return { status: "ready" as const, canvas: entry && toCanvas(manifest, entry) };
    },
  }),
  resolve: resolveCanvasCommand,
  list: defineCommand({
    id: "list",
    title: "List canvases",
    cli: true,
    async run(ctx) {
      const build = await readBuild(buildFiles(ctx));
      const canvases = build.status === "ready" ? build.manifest.canvases : [];
      return {
        status: build.status,
        canvases: canvases.map(({ id, name, group, frames, error }) => ({
          id,
          name,
          group,
          previewCount: frames.length,
          ...(error ? { error } : {}),
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
      const canvas = await readCanvas(ctx, input.canvas);
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
      return loadLayout(ctx.storage, await readCanvas(ctx, input.canvas));
    },
  }),
  "layout.update": defineCommand({
    id: "layout.update",
    title: "Update canvas layout",
    cli: true,
    mutating: true,
    params: { ...canvasParam, change: params.json({ required: true, label: "Camera, positions, or frame themes" }) },
    async run(ctx, input) {
      const canvas = await readCanvas(ctx, input.canvas);
      const next = await saveLayout(ctx.storage, canvas, input.change);
      await ctx.events.emit(layoutChanged, { canvas: canvas.id });
      return next;
    },
  }),
};
