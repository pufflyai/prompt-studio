import {
  defineExtension,
  defineHook,
  defineKeybinding,
  defineNavigationItem,
  defineSchedule,
  gitEvents,
  l10n,
  packageAsset,
  projectEvents,
  sessionEvents,
  workbenchModes,
} from "@pstdio/sdk/extensions";
import { checkWorkspace } from "./src/checks";
import { commands } from "./src/commands";
import { navigationTree, navigationView, openCommand, page, view } from "./src/navigation";
import { resourceContributions } from "./src/resources";

const check = async (ctx: Parameters<typeof checkWorkspace>[0]) => {
  try {
    await checkWorkspace(ctx);
  } catch (error) {
    ctx.logger.warn("Requirement check unavailable", { error: String(error) });
  }
};
export default defineExtension({
  settings: {
    properties: {
      workspaceId: { type: "string", scope: "project", default: "", title: "Book workspace" },
      targetBranch: { type: "string", scope: "project", default: "main", title: "Accepted target branch" },
    },
  },
  defaultLocale: "en",
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
  hooks: [
    defineHook({ id: "check-after-session", event: sessionEvents.completed, run: check }),
    defineHook({ id: "check-after-commit", event: gitEvents.committed, run: check }),
    defineHook({ id: "check-after-merge", event: gitEvents.merged, run: check }),
    defineHook({ id: "check-on-open", event: projectEvents.opened, run: check }),
  ],
  schedules: [
    defineSchedule({
      id: "check",
      title: l10n("book.check", "Check requirement evidence"),
      schedule: "* * * * *",
      command: commands.check.ref,
      enabled: true,
    }),
  ],
});
