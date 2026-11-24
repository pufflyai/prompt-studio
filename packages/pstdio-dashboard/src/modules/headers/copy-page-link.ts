import { type WorkbenchModuleContext, workbenchBreadcrumbLocationMenuPath } from "@pstdio/workbench";

const copyPageLinkCommandId = "dashboard.page.copyLink";

// The workbench writes every page location, including the selected document, into the browser URL.
// That URL is the canonical link to where the user is, so the breadcrumb can share it on every page.
export const registerCopyPageLink = (ctx: WorkbenchModuleContext) => {
  ctx.commands.registerCommand(
    { id: copyPageLinkCommandId, label: "Copy link", icon: "link" },
    {
      execute: async () => {
        const pending = ctx.notifications.show({ level: "info", title: "Copying link…" });
        try {
          await navigator.clipboard.writeText(window.location.href);
        } finally {
          ctx.notifications.dismiss(pending.id);
        }
        ctx.notifications.show({ level: "success", title: "Link copied" });
      },
    },
  );
  ctx.layout.registerMenuItem(workbenchBreadcrumbLocationMenuPath, { commandId: copyPageLinkCommandId });
};
