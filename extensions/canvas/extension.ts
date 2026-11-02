import {
  defineExtension,
  defineNavigationItem,
  defineNavigationTree,
  defineSkill,
  defineView,
  packageAsset,
  workbenchModes,
} from "@pstdio/sdk/extensions";
import { buildChanged, buildFiles, buildMount, readBuild } from "./src/build-mount";
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
    // The watcher's first build, and every added, renamed or removed canvas file, changes the list.
    refreshEvents: [buildChanged],
    body: async (ctx) => {
      const build = await readBuild(buildFiles(ctx));
      return [
        {
          id: "canvases",
          label: "UI Canvas",
          collapsible: false,
          nodes: canvasTree(ctx.projectId, build.status === "ready" ? build.manifest.canvases : []),
        },
      ];
    },
  },
});
export default defineExtension({
  commands: Object.values(commands),
  artifactMounts: [buildMount],
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
