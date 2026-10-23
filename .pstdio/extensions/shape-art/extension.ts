import {
  defineExtension,
  defineKeybinding,
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
  keybindings: [
    defineKeybinding({
      id: "keyboard-open",
      layer: "extensions",
      key: "O",
      sticky: true,
      action: { kind: "page", page: page.ref },
    }),
    ...(
      [
        ["piece.generate", "N"],
        ["piece.render", "R"],
        ["piece.read", "P"],
      ] as const
    ).flatMap(([id, key]) => [
      defineKeybinding({
        id: `keyboard-${id}`,
        layer: "extensions",
        key,
        action: { kind: "command", target: { command: commands[id].ref } },
      }),
      defineKeybinding({
        id: `current-${id}`,
        layer: "current",
        key,
        targetScope: "panel",
        when: { view: studio.ref },
        action: { kind: "command", target: { command: commands[id].ref } },
      }),
    ]),
  ],
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
