import {
  defineArtifactMount,
  defineExtension,
  defineNavigationItem,
  definePlacement,
  defineSkill,
  defineView,
  l10n,
  packageAsset,
  workbenchModes,
  workbenchSlots,
} from "@pstdio/sdk/extensions";
import { fontCommands } from "./src/commands/font-commands";

const fontEditor = defineView({
  id: "font-editor",
  title: l10n("panels.fontEditor.title", "Font editor"),
  body: {
    kind: "webview",
    entry: packageAsset("./src/views/main.tsx", import.meta.url),
    capabilities: ["commands.execute", "notification.show"],
  },
});

const extension = defineExtension({
  commands: fontCommands,
  views: [fontEditor],
  placements: [
    definePlacement({
      id: "font-editor.project",
      mode: workbenchModes.project,
      item: { kind: "view", view: fontEditor.ref },
      region: "main",
    }),
  ],
  navigationItems: [
    defineNavigationItem({
      id: "font-editor",
      slot: workbenchSlots.projectNavigation,
      group: "Tools",
      label: l10n("treeItems.fontEditor.label", "Font editor"),
      icon: "case-upper",
      when: { mode: workbenchModes.project },
      action: { kind: "view", view: fontEditor.ref },
    }),
  ],
  artifactMounts: [
    defineArtifactMount({
      id: "fontEditor",
      path: "data",
      label: l10n("artifactMounts.fontEditor.label", "Font editor files"),
      repoRole: "default",
    }),
  ],
  skills: [
    defineSkill({
      id: "fontEditor",
      title: l10n("skills.fontEditor.title", "Font editor"),
      source: packageAsset("./skills/font-editor", import.meta.url),
    }),
  ],
});

export default extension;
