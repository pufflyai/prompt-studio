import {
  createWorkbenchSelectionResourceMetadata,
  type Disposable,
  type ResourceRef,
  type WorkbenchModuleContributionContext,
} from "pstdio-workbench/core";
import { subscribeToExtensionCommandFeed } from "@/shared/extensions/extension-webview-broadcast";
import type { DashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";
import { setResourceBreadcrumb } from "@/shared/workbench/resource-sync";
import { createExtensionDataRendererResource } from "./extension-data-renderers";
import { extensionViewArea, extensionViewWidgetIdFor } from "./extension-mode-layout";
import { groupResourceEditorViews } from "./extension-resource-editor-grouping";

const outcomeValueId = (value: unknown) => {
  if (!value || typeof value !== "object") return undefined;
  const id = (value as { id?: unknown }).id;
  return typeof id === "string" ? id : undefined;
};

// Re-derives a resource's display label from a command outcome, mirroring the dashboard's
// existing `[shorthand, title]` convention (see extension-data-renderers onAfterCreate).
const resourceLabelFromOutcomeValue = (value: unknown) => {
  if (!value || typeof value !== "object") return undefined;
  const record = value as { shorthand?: unknown; title?: unknown; label?: unknown };
  const composed = [record.shorthand, record.title]
    .filter((part): part is string => typeof part === "string" && part.length > 0)
    .join(" ");
  if (composed) return composed;
  return typeof record.label === "string" && record.label ? record.label : undefined;
};

type ExtensionViewRecord = DashboardExtensionMetadata["views"][number];

const widgetIdFor = (view: ExtensionViewRecord) => extensionViewWidgetIdFor(view);

const parentResourceFor = (input: { kind: string; metadata: DashboardExtensionMetadata; projectId: string }) => {
  const parentRenderer = input.metadata.dataRenderers?.find((record) => record.resourceKind === input.kind);
  return parentRenderer ? createExtensionDataRendererResource(parentRenderer, input.projectId) : undefined;
};

const withParentSelectionResource = (
  resource: ResourceRef,
  input: { kind: string; metadata: DashboardExtensionMetadata; projectId: string },
) => {
  const parentResource = parentResourceFor(input);
  if (!parentResource) return resource;

  return {
    ...resource,
    metadata: {
      ...resource.metadata,
      ...createWorkbenchSelectionResourceMetadata(parentResource),
    },
  };
};

const setExtensionResourceBreadcrumb = (
  ctx: WorkbenchModuleContributionContext,
  input: { kind: string; metadata: DashboardExtensionMetadata; projectId: string; resource: ResourceRef },
) => {
  const parentResource = parentResourceFor(input);
  if (!parentResource) {
    setResourceBreadcrumb(ctx, input.resource);
    return;
  }

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
          const selectedResource = withParentSelectionResource(resource, {
            kind,
            metadata: input.metadata,
            projectId: input.projectId,
          });
          ctx.modes.setActiveMode("project");
          setExtensionResourceBreadcrumb(ctx, {
            kind,
            metadata: input.metadata,
            projectId: input.projectId,
            resource: selectedResource,
          });
          removeManagedCompanions(ctx, managedCompanionWidgetIds, expectedCompanionWidgetIds);
          const placement = ctx.layout.openWidget(widgetIdFor(primary), {
            resource: selectedResource,
            title: selectedResource.label,
            replaceActive: openInput.replaceActive,
          });

          // replaceActive keeps a single companion in its area as the user switches
          // resources instead of stacking a new panel per open.
          for (const companion of companions) {
            ctx.layout.openWidget(widgetIdFor(companion), {
              resource: selectedResource,
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

  // Tracks the editor resource currently in the primary area so the command feed can
  // refresh just its breadcrumb when a save changes the display title.
  let activeResource: ResourceRef | undefined;

  disposables.push(
    ctx.onDidChangePrimaryResource((resource) => {
      const group = resource ? groupByKind.get(resource.kind) : undefined;
      activeResource = group ? resource : undefined;

      if (managedCompanionWidgetIds.size > 0) {
        const keepWidgetIds = group ? new Set(group.companions.map(widgetIdFor)) : undefined;
        removeManagedCompanions(ctx, managedCompanionWidgetIds, keepWidgetIds);
      }
    }),
  );

  // Editor saves (e.g. retitling a ticket) run through the extension command feed. When a
  // command updates the open resource's display label, re-derive the breadcrumb so it
  // tracks the live title instead of the snapshot captured when the resource was opened.
  disposables.push({
    dispose: subscribeToExtensionCommandFeed((event) => {
      if (!activeResource || !event.outcome.ok) return;
      if (outcomeValueId(event.outcome.value) !== activeResource.id) return;

      const label = resourceLabelFromOutcomeValue(event.outcome.value);
      if (!label || label === activeResource.label) return;

      activeResource = { ...activeResource, label };
      setExtensionResourceBreadcrumb(ctx, {
        kind: activeResource.kind,
        metadata: input.metadata,
        projectId: input.projectId,
        resource: activeResource,
      });
    }),
  });

  return disposables;
};
