import {
  defineExtension,
  defineNavigationItem,
  defineNavigationTree,
  defineSkill,
  defineView,
  packageAsset,
  workbenchModes,
} from "@pstdio/sdk/extensions";
import { commands } from "./src/commands";
import { canvasPage, canvasPanel, canvasResource, canvasView, homePage } from "./src/navigation";
import { canvasTree } from "./src/navigation-tree";
import { canvasResources } from "./src/resources";

const tree = defineView({
  id: "canvases",
  title: "UI Canvas",
  icon: canvasResource.icon,
  body: {
    kind: "tree",
    body: async (ctx) => [
      {
        id: "canvases",
        label: "UI Canvas",
        collapsible: false,
        nodes: canvasTree(ctx.projectId),
      },
    ],
  },
});
export default defineExtension({
  commands: Object.values(commands),
  resourceKinds: [canvasResource],
  commandPaletteResources: [canvasResources],
  views: [canvasView, tree],
  placements: [canvasPanel],
  pages: [homePage, canvasPage],
  navigationItems: [
    defineNavigationItem({
      id: "canvases",
      label: "UI Canvas",
      icon: canvasResource.icon,
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
