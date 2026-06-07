import type { Disposable, ResourceRef, WorkbenchModuleContributionContext } from "pstdio-workbench/core";
import type { DashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";
import { setResourceBreadcrumb } from "@/shared/workbench/resource-sync";
import { createExtensionDataRendererResource } from "./extension-data-renderers";
import { extensionViewArea, extensionViewWidgetIdFor } from "./extension-mode-layout";
import { groupResourceEditorViews } from "./extension-resource-editor-grouping";

type ExtensionViewRecord = DashboardExtensionMetadata["views"][number];

const widgetIdFor = (view: ExtensionViewRecord) => extensionViewWidgetIdFor(view);

const setExtensionResourceBreadcrumb = (
  ctx: WorkbenchModuleContributionContext,
  input: { kind: string; metadata: DashboardExtensionMetadata; projectId: string; resource: ResourceRef },
) => {
  const parentRenderer = input.metadata.dataRenderers?.find((record) => record.resourceKind === input.kind);
  if (!parentRenderer) {
    setResourceBreadcrumb(ctx, input.resource);
    return;
  }

  const parentResource = createExtensionDataRendererResource(parentRenderer, input.projectId);
  ctx.breadcrumbs.setItems([
    {
      title: parentResource.label,
      icon: parentResource.icon,
      resource: parentResource,
      onClick: () => void ctx.resources.openResource(parentResource, { replaceActive: true }),
    },
    {
      title: input.resource.label ?? input.resource.id ?? input.kind,
      icon: input.resource.icon,
      resource: input.resource,
    },
  ]);
};

const removeManagedCompanions = (
  ctx: WorkbenchModuleContributionContext,
  managedWidgetIds: Set<string>,
  keepWidgetIds = new Set<string>(),
) => {
  for (const area of Object.values(ctx.layout.getLayout().areas)) {
    for (const placement of area.widgets) {
      if (!managedWidgetIds.has(placement.contributionId) || keepWidgetIds.has(placement.contributionId)) continue;
      ctx.layout.removeWidgetPlacement(placement.widgetId);
    }
  }
};

// A view that declares a `resourceKind` is the primary view for that kind. Opening a domain
// resource of that kind mounts the primary extension webview in the main area, plus any
// companion side-panel views (e.g. a properties panel) bound to the same resource. The domain
// resource stays the navigable identity — the renderer derives which view to mount from the
// resource kind + cached manifest (PS-11), so no renderer metadata is stored on the resource.
export const registerExtensionResourceView = (
  ctx: WorkbenchModuleContributionContext,
  input: { metadata: DashboardExtensionMetadata; projectId: string },
) => {
  const disposables: Disposable[] = [];
  const groups = groupResourceEditorViews(input.metadata.views);
  const groupByKind = new Map(groups.map((group) => [group.kind, group]));
  const managedCompanionWidgetIds = new Set(groups.flatMap((group) => group.companions.map(widgetIdFor)));

  for (const { kind, primary, companions } of groups) {
    disposables.push(
      ctx.resources.registerOpener({
        id: `dashboard.extensions.resource-view.${kind}`,
        priority: 1100,
        canOpen: (resource) => resource.kind === kind,
        open: (resource, openInput) => {
          const expectedCompanionWidgetIds = new Set(companions.map(widgetIdFor));
          ctx.modes.setActiveMode("project");
          setExtensionResourceBreadcrumb(ctx, { kind, metadata: input.metadata, projectId: input.projectId, resource });
          removeManagedCompanions(ctx, managedCompanionWidgetIds, expectedCompanionWidgetIds);
          const placement = ctx.layout.openWidget(widgetIdFor(primary), {
            resource,
            title: resource.label,
            replaceActive: openInput.replaceActive,
          });

          // replaceActive keeps a single companion in its area as the user switches
          // resources instead of stacking a new panel per open.
          for (const companion of companions) {
            ctx.layout.openWidget(widgetIdFor(companion), {
              resource,
              area: extensionViewArea(companion.target),
              title: companion.title,
              replaceActive: true,
            });
          }

          ctx.layout.activateWidget(placement.widgetId);

          return placement;
        },
      }),
    );
  }

  if (managedCompanionWidgetIds.size > 0) {
    disposables.push(
      ctx.onDidChangePrimaryResource((resource) => {
        const group = resource ? groupByKind.get(resource.kind) : undefined;
        const keepWidgetIds = group ? new Set(group.companions.map(widgetIdFor)) : undefined;

        removeManagedCompanions(ctx, managedCompanionWidgetIds, keepWidgetIds);
      }),
    );
  }

  return disposables;
};
