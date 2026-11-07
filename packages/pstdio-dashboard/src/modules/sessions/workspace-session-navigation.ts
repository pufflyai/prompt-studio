import type { Disposable, WorkbenchModuleContext } from "@pstdio/workbench";
import { getDashboardSelectedProjectId } from "@/shared/app/project-context";
import { createDashboardSessions } from "./data/dashboard-sessions";
import { buildWorkspaceSessionsSections } from "./sessions-sidenav-tree";

export const registerWorkspaceSessionNavigation = (ctx: WorkbenchModuleContext) => {
  const registrations = new Map<string, Disposable>();
  const sync = () => {
    const pages = ctx.pages
      .listPages()
      .filter(
        (page) =>
          !page.redirect &&
          ["workspace", "overview", "history"].includes(page.path) &&
          page.resource?.kinds.some(
            (kind) => kind.id === "workspace" && (!kind.extensionId || kind.extensionId === "pstdio"),
          ),
      );
    for (const [id, registration] of registrations) {
      if (pages.some((page) => page.id === id)) continue;
      registrations.delete(id);
      registration.dispose();
    }
    for (const page of pages) {
      if (registrations.has(page.id)) continue;
      registrations.set(
        page.id,
        ctx.navigationTrees.registerContribution({
          id: `dashboard.sessions.workspace-level.${page.id}`,
          owner: { kind: "page", id: page.id, extensionId: page.ref.extensionId ?? "pstdio" },
          sourceExtensionId: "pstdio",
          declarationIndex: 0,
          getSections: ({ resource }) =>
            resource?.type === "workspace"
              ? buildWorkspaceSessionsSections(createDashboardSessions(getDashboardSelectedProjectId(ctx)), resource)
              : [],
        }),
      );
    }
  };
  const unsubscribe = ctx.pages.store.subscribeSelector((state) => state.pages, sync);
  sync();
  return {
    dispose() {
      unsubscribe();
      for (const registration of registrations.values()) registration.dispose();
    },
  };
};
