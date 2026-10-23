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

const tree = defineView({
  id: "canvases",
  title: "Canvases",
  body: {
    kind: "tree",
    body: async () => [
      {
        id: "canvases",
        label: "Canvases",
        collapsible: false,
        nodes: canvases.map((canvas) => ({
          id: canvas.id,
          label: canvas.name,
          icon: "layout-dashboard",
          target: canvasTarget(canvas.id, canvas.name),
          resource: { type: canvasResource.id, id: canvas.id, label: canvas.name },
        })),
      },
    ],
  },
});
export default defineExtension({
  commands: Object.values(commands),
  resourceKinds: [canvasResource],
  views: [canvasView, tree],
  pages: [homePage, canvasPage],
  navigationItems: [
    defineNavigationItem({
      id: "canvases",
      label: "Canvases",
      icon: "layout-dashboard",
      owner: workbenchModes.project,
      slot: "content",
      action: { kind: "page", page: homePage.ref },
    }),
  ],
  navigationTrees: [
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
