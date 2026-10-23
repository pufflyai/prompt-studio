import {
  defineArtifactMount,
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
import { fontCommands } from "./src/commands/font-commands";

const fontEditor = defineView({
  id: "font-editor",
  title: l10n("panels.fontEditor.title", "Icon Set editor"),
  body: {
    kind: "webview",
    entry: packageAsset("./src/views/main.tsx", import.meta.url),
    capabilities: ["commands.execute", "notification.show"],
  },
});
const fontEditorPage = definePage({
  id: "font-editor",
  title: l10n("panels.fontEditor.title", "Icon Set editor"),
  path: "font-editor",
  mode: workbenchModes.project,
  main: {
    kind: "view",
    view: fontEditor.ref,
    cardinality: "one",
  },
  slots: [],
});
const extension = defineExtension({
  commands: fontCommands,
  keybindings: [
    defineKeybinding({
      id: "keyboard-open",
      layer: "extensions",
      key: "O",
      sticky: true,
      action: { kind: "page", page: fontEditorPage.ref },
    }),
    ...(
      [
        ["glyph.add", "N"],
        ["glyph.rename", "R"],
        ["glyph.codepoint", "C"],
        ["build", "B"],
        ["verify", "V"],
      ] as const
    ).flatMap(([id, key]) => {
      const command = fontCommands.find((command) => command.id === id)!;
      return [
        defineKeybinding({
          id: `keyboard-${id}`,
          layer: "extensions",
          key,
          action: { kind: "command", target: { command: command.ref } },
        }),
        defineKeybinding({
          id: `current-${id}`,
          layer: "current",
          key,
          targetScope: "panel",
          when: { view: fontEditor.ref },
          action: { kind: "command", target: { command: command.ref } },
        }),
      ];
    }),
  ],
  views: [fontEditor],
  pages: [fontEditorPage],
  navigationItems: [
    defineNavigationItem({
      id: "font-editor",
      owner: workbenchModes.project,
      slot: "content",
      label: l10n("treeItems.fontEditor.label", "Icon Set editor"),
      icon: "case-upper",
      when: { mode: workbenchModes.project },
      action: { kind: "page", page: fontEditorPage.ref },
    }),
  ],
  artifactMounts: [
    defineArtifactMount({
      id: "font-editor",
      path: "data",
      label: l10n("artifactMounts.fontEditor.label", "Icon Set editor files"),
    }),
  ],
  skills: [
    defineSkill({
      id: "font-editor",
      title: l10n("skills.fontEditor.title", "Icon Set editor"),
      source: packageAsset("./skills/font-editor", import.meta.url),
    }),
  ],
});
export default extension;
