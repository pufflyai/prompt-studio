import { isLocalizedString } from "@pstdio/sdk/extensions";
import type { WorkbenchModuleContext } from "@pstdio/workbench";

type WorkbenchPage = ReturnType<WorkbenchModuleContext["pages"]["listPages"]>[number];

const toolTitle = (page: WorkbenchPage) => {
  if (page.title === undefined) return page.ref.id;
  if (!isLocalizedString(page.title)) return page.title;
  return page.title.default ?? page.title.$l10n;
};

// A tool is a top-level page an extension contributes. Pages under a parent open one
// resource of that tool, and host pages are reachable from the project navigation.
const isToolPage = (page: WorkbenchPage) => page.ref.extensionId !== "pstdio" && !page.parentId;

/** Lists extension tools in search and in the "Open a tool" palette. */
export const registerToolResources = (ctx: WorkbenchModuleContext) => {
  const kind = ctx.resources.registerKind({ kind: "tool", label: "Tool", icon: "panels-top-left" });
  const provider = ctx.resources.registerProvider({
    id: "dashboard.start.tools",
    kind: "tool",
    list: () =>
      ctx.pages
        .listPages()
        .filter(isToolPage)
        .map((page) => ({
          resource: { type: "tool", id: page.id, label: toolTitle(page), icon: page.icon },
          group: "Tools",
          activate: () => ctx.pageLocations.navigate({ kind: "page", page: page.ref }),
        })),
  });
  return [kind, provider];
};
