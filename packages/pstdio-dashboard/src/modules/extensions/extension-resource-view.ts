import type { Disposable, WorkbenchModuleContributionContext } from "pstdio-workbench/core";
import type { DashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";
import { setResourceBreadcrumb } from "@/shared/workbench/resource-sync";
import { extensionViewArea, extensionViewWidgetId } from "./extension-mode-layout";
import { groupResourceEditorViews } from "./extension-resource-editor-grouping";

// A view that declares a `resourceKind` is the primary view for that kind. Opening a domain
// resource of that kind mounts the primary extension webview in the main area, plus any
// companion side-panel views (e.g. a properties panel) bound to the same resource. The domain
// resource stays the navigable identity — the renderer derives which view to mount from the
// resource kind + cached manifest (PS-11), so no renderer metadata is stored on the resource.
export const registerExtensionResourceView = (
  ctx: WorkbenchModuleContributionContext,
  input: { metadata: DashboardExtensionMetadata },
) => {
  const disposables: Disposable[] = [];

  for (const { kind, primary, companions } of groupResourceEditorViews(input.metadata.views)) {
    disposables.push(
      ctx.resources.registerOpener({
        id: `dashboard.extensions.resource-view.${kind}`,
        priority: 1100,
        canOpen: (resource) => resource.kind === kind,
        open: (resource, openInput) => {
          ctx.modes.setActiveMode("project");
          setResourceBreadcrumb(ctx, resource);
          const placement = ctx.layout.openWidget(extensionViewWidgetId(primary.id), {
            resource,
            title: resource.label,
            replaceActive: openInput.replaceActive,
          });

          // replaceActive keeps a single companion in its area as the user switches
          // resources instead of stacking a new panel per open.
          for (const companion of companions) {
            ctx.layout.openWidget(extensionViewWidgetId(companion.id), {
              resource,
              area: extensionViewArea(companion.target),
              title: companion.title,
              replaceActive: true,
            });
          }

          return placement;
        },
      }),
    );
  }

  return disposables;
};
