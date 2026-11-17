import {
  defineExtension,
  defineKeybinding,
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
import { settingsView } from "./src/settings-view";
import { studioCommands } from "./src/studio-commands";

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
  main: { kind: "view", view: studio.ref, cardinality: "one", presentation: "page" },
  slots: [],
});

export default defineExtension({
  commands: [...Object.values(commands), ...Object.values(studioCommands)],
  keybindings: [
    defineKeybinding({
      id: "keyboard-open",
      layer: "go",
      key: "S",
      sticky: true,
      action: { kind: "page", page: page.ref },
    }),
    defineKeybinding({
      id: "create-piece",
      layer: "create",
      key: "P",
      action: { kind: "command", target: { command: commands["piece.generate"].ref } },
    }),
    ...(
      [
        ["piece.render", "R"],
        ["piece.read", "P"],
      ] as const
    ).map(([id, key]) =>
      defineKeybinding({
        id: `current-${id}`,
        layer: "current",
        key,
        targetScope: "panel",
        when: { view: studio.ref },
        action: { kind: "command", target: { command: commands[id].ref } },
      }),
    ),
  ],
  views: [studio, settingsView],
  viewMenus: [defineViewMenu({ id: "settings", owner: studio.ref, view: settingsView.ref, side: "right" })],
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
