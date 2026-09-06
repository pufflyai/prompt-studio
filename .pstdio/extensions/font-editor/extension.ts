import {
  defineArtifactMount,
  defineExtension,
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
  title: l10n("panels.fontEditor.title", "Font editor"),
  body: {
    kind: "webview",
    entry: packageAsset("./src/views/main.tsx", import.meta.url),
    capabilities: ["commands.execute", "notification.show"],
  },
});
const fontEditorPage = definePage({
  id: "font-editor",
  title: l10n("panels.fontEditor.title", "Font editor"),
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
  views: [fontEditor],
  pages: [fontEditorPage],
  navigationItems: [
    defineNavigationItem({
      id: "font-editor",
      owner: workbenchModes.project,
      slot: "content",
      group: "Tools",
      label: l10n("treeItems.fontEditor.label", "Font editor"),
      icon: "case-upper",
      when: { mode: workbenchModes.project },
      action: { kind: "page", page: fontEditorPage.ref },
    }),
  ],
  artifactMounts: [
    defineArtifactMount({
      id: "font-editor",
      path: "data",
      label: l10n("artifactMounts.fontEditor.label", "Font editor files"),
      repoRole: "default",
    }),
  ],
  skills: [
    defineSkill({
      id: "font-editor",
      title: l10n("skills.fontEditor.title", "Font editor"),
      source: packageAsset("./skills/font-editor", import.meta.url),
    }),
  ],
});
export default extension;
