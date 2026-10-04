import {
  defineExtension,
  defineNavigationItem,
  definePage,
  defineSkill,
  defineView,
  defineViewMenu,
  l10n,
  packageAsset,
  workbenchModes,
} from "@pstdio/sdk/extensions";
import { commands } from "./src/commands";
import { controls } from "./src/controls";
import { shaderVersion } from "./src/navigation";
import { versionsTree } from "./src/tree";

const preview = defineView({
  id: "preview",
  title: "Preview",
  icon: "blend",
  body: {
    kind: "webview",
    entry: packageAsset("./src/preview-entry.tsx", import.meta.url),
    capabilities: ["commands.execute"],
  },
});

const home = definePage({
  id: "shader-lab",
  title: "Shader Lab",
  path: "shader-lab",
  mode: workbenchModes.project,
  main: { kind: "view", view: preview.ref, cardinality: "one" },
  slots: [],
});

const version = definePage({
  id: "version",
  title: "Shader Lab",
  path: "shader-lab/version",
  mode: workbenchModes.project,
  parent: home.ref,
  resource: { kinds: [shaderVersion.ref] },
  main: { kind: "view", view: preview.ref, cardinality: "one" },
  slots: [],
});

export default defineExtension({
  commands: Object.values(commands),
  resourceKinds: [shaderVersion],
  views: [preview, versionsTree, controls],
  pages: [home, version],
  viewMenus: [
    defineViewMenu({ id: "versions", owner: preview.ref, view: versionsTree.ref, side: "left" }),
    defineViewMenu({ id: "controls", owner: preview.ref, view: controls.ref, side: "right" }),
  ],
  skills: [
    defineSkill({
      id: "shader-lab",
      title: "Shader Lab",
      source: packageAsset("./skills/shader-lab", import.meta.url),
    }),
  ],
  navigationItems: [
    defineNavigationItem({
      id: "shader-lab",
      owner: workbenchModes.project,
      slot: "content",
      label: l10n("shaderLab.title", "Shader Lab"),
      icon: "blend",
      action: { kind: "page", page: home.ref },
    }),
  ],
});
