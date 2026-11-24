import {
  defineExtension,
  defineKeybinding,
  defineNavigationItem,
  l10n,
  packageAsset,
  workbenchModes,
} from "@pstdio/sdk/extensions";
import { authoringDraftFailed } from "./src/authoring-draft-hook";
import { commands } from "./src/commands";
import { navigationTree, navigationView, openCommand, page, view } from "./src/navigation";
import { resourceContributions } from "./src/resources";

export default defineExtension({
  settings: {
    properties: {
      workspaceId: {
        type: "string",
        scope: "project",
        default: "",
        title: l10n("book.settings.workspace", "Book workspace"),
      },
      targetBranch: {
        type: "string",
        scope: "project",
        default: "main",
        title: l10n("book.settings.target-branch", "Accepted target branch"),
      },
    },
  },
  defaultLocale: "en",
  hooks: [authoringDraftFailed],
  translations: { fr: packageAsset("./l10n/fr.json", import.meta.url) },
  commands: [...Object.values(commands), openCommand, ...resourceContributions.map((item) => item.resolve)],
  resourceKinds: resourceContributions.map((item) => item.kind),
  commandPaletteResources: resourceContributions.map((item) => item.search),
  views: [view, navigationView],
  pages: [page, ...resourceContributions.map((item) => item.page)],
  navigationTrees: [navigationTree],
  navigationItems: [
    defineNavigationItem({
      id: "book",
      label: l10n("book.title", "Requirement book"),
      icon: "book-open",
      owner: workbenchModes.project,
      action: { kind: "page", page: page.ref },
    }),
  ],
  keybindings: [
    defineKeybinding({ id: "go-book", layer: "go", key: "R", sticky: true, action: { kind: "page", page: page.ref } }),
  ],
});
