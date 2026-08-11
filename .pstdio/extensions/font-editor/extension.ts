import { defineExtension, l10n, packageAsset } from "@pstdio/sdk/extensions";
import { fontCommands } from "./src/commands/font-commands";

const extension = defineExtension({
  commands: fontCommands,
  routes: {
    fontEditor: {
      path: "font-editor",
      label: l10n("routes.fontEditor.label", "Font editor"),
      webview: {
        entry: packageAsset("./src/views/main.tsx", import.meta.url),
        capabilities: ["commands.execute", "notification.show"],
      },
    },
  },
  treeItems: {
    fontEditor: {
      target: "workbench.left.tree",
      group: "Tools",
      label: l10n("routes.fontEditor.label", "Font editor"),
      icon: "case-upper",
      action: { kind: "route", route: "font-editor" },
    },
  },
  artifactMounts: {
    fontEditor: {
      path: "data",
      label: l10n("artifactMounts.fontEditor.label", "Font editor files"),
      repoRole: "default",
    },
  },
  skills: {
    fontEditor: {
      title: l10n("skills.fontEditor.title", "Font editor"),
      source: packageAsset("./skills/font-editor", import.meta.url),
    },
  },
});

export default extension;
