import {
  defineExtension,
  defineNavigationItem,
  defineNavigationTree,
  defineSkill,
  defineView,
  packageAsset,
  workbenchModes,
} from "@pstdio/sdk/extensions";
import { canvases } from "./src/canvases/definitions";
import { commands } from "./src/commands";
import { canvasPage, canvasResource, canvasTarget, canvasView, homePage } from "./src/navigation";
import { canvasResources } from "./src/resources";

const tree = defineView({
  id: "canvases",
  title: "UI Canvas",
  body: {
    kind: "tree",
    body: async (ctx) => [
      {
        id: "canvases",
        label: "UI Canvas",
        collapsible: false,
        nodes: [...new Set(canvases.map((canvas) => canvas.group ?? "Designs"))].map((group) => ({
          id: `group-${group}`,
          label: group,
          collapsible: true,
          children: canvases
            .filter((canvas) => (canvas.group ?? "Designs") === group)
            .map((canvas) => ({
              id: canvas.id,
              label: canvas.name,
              icon: "layout-dashboard",
              target: canvasTarget(canvas.id, canvas.name, ctx.projectId),
              resource: {
                type: canvasResource.id,
                id: canvas.id,
                label: canvas.name,
                projectId: ctx.projectId,
                extensionId: "pstdio.canvas",
              },
            })),
        })),
      },
    ],
  },
});
export default defineExtension({
  commands: Object.values(commands),
  resourceKinds: [canvasResource],
  commandPaletteResources: [canvasResources],
  views: [canvasView, tree],
  pages: [homePage, canvasPage],
  navigationItems: [
    defineNavigationItem({
      id: "canvases",
      label: "UI Canvas",
      icon: "layout-dashboard",
      owner: workbenchModes.project,
      slot: "content",
      action: { kind: "page", page: homePage.ref },
    }),
  ],
  navigationTrees: [
    defineNavigationTree({
      id: "canvas-selection",
      owner: canvasPage.ref,
      slot: "content",
      view: tree.ref,
      resourceScope: "project",
    }),
    defineNavigationTree({
      id: "canvases",
      owner: homePage.ref,
      slot: "content",
      view: tree.ref,
      resourceScope: "project",
    }),
  ],
  skills: [
    defineSkill({
      id: "canvas",
      title: "Update canvas designs",
      source: packageAsset("./skills/canvas", import.meta.url),
    }),
  ],
});
