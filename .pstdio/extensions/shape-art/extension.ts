import {
  defineExtension,
  defineNavigationItem,
  definePage,
  defineSkill,
  defineView,
  l10n,
  packageAsset,
  workbenchModes,
} from "@pstdio/sdk/extensions";
import { commands } from "./src/commands";

const studio = defineView({
  id: "studio",
  title: l10n("views.studio.title", "Shape Art"),
  body: {
    kind: "webview",
    entry: packageAsset("./src/view/main.tsx", import.meta.url),
    capabilities: ["commands.execute", "notification.show"],
  },
});

const page = definePage({
  id: "shape-art",
  title: l10n("pages.shapeArt.title", "Shape Art"),
  path: "shape-art",
  mode: workbenchModes.project,
  main: { kind: "view", view: studio.ref, cardinality: "one" },
  slots: [],
});

export default defineExtension({
  commands: Object.values(commands),
  views: [studio],
  pages: [page],
  navigationItems: [
    defineNavigationItem({
      id: "shape-art",
      owner: workbenchModes.project,
      slot: "content",
      label: l10n("navigation.shapeArt.label", "Shape Art"),
      icon: "palette",
      action: { kind: "page", page: page.ref },
    }),
  ],
  skills: [
    defineSkill({
      id: "shape-art",
      title: l10n("skills.shapeArt.title", "Shape Art pieces"),
      source: packageAsset("./skills/shape-art", import.meta.url),
    }),
  ],
});
