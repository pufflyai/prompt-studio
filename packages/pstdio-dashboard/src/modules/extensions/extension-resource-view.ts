import {
  createWorkbenchSelectionResourceMetadata,
  type Disposable,
  type ResourceRef,
  type WorkbenchModuleContributionContext,
} from "@pstdio/workbench/core";
import { subscribeToExtensionCommandFeed } from "@/shared/extensions/extension-webview-broadcast";
import type { DashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";
import { setResourceBreadcrumb } from "@/shared/workbench/resource-sync";
import { createExtensionDataRendererResource } from "./extension-data-renderer-resource";
import { groupResourceEditorViews, type ResourceEditorGroup } from "./extension-resource-editor-grouping";
import { extensionModeLayoutRegion, extensionViewRegion, extensionViewWidgetIdFor } from "./extension-view-placement";

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
type ExtensionModeRecord = DashboardExtensionMetadata["modes"][number];
type ModeLayoutOpenEntry = NonNullable<NonNullable<ExtensionModeRecord["layout"]>["open"]>[number];

const widgetIdFor = (view: ExtensionViewRecord) => extensionViewWidgetIdFor(view);

const companionViewTitle = (view: ExtensionViewRecord, resource: ResourceRef, region: string) =>
  region === "sidebar" || region === "main-left-menu" ? (resource.label ?? view.title) : view.title;

const resourceModeFor = (metadata: DashboardExtensionMetadata, kind: string) =>
  metadata.modes.find((mode) => mode.resourceKind === kind);

const resourceModeEntryForView = (view: ExtensionViewRecord, resourceMode: ExtensionModeRecord | undefined) => {
  if (!resourceMode || resourceMode.resourceKind !== view.resourceKind) return undefined;
  return resourceMode.layout?.open?.find((entry) => entry.view === view.id);
};

const resourceGroupOwnsEvent = (group: ResourceEditorGroup, event: { extensionId: string }) =>
  group.primary.extensionId === event.extensionId ||
  group.companions.some((companion) => companion.extensionId === event.extensionId);

const companionViewRegion = (view: ExtensionViewRecord, modeEntry: ModeLayoutOpenEntry | undefined) =>
  modeEntry ? extensionModeLayoutRegion(modeEntry.target) : extensionViewRegion(view.target);

const hasPlacementForResource = (ctx: WorkbenchModuleContributionContext, widgetId: string, resource: ResourceRef) =>
  Object.values(ctx.layout.getLayout().regions).some((region) =>
    region.widgets.some((placement) => placement.contributionId === widgetId && placement.resourceUri === resource.uri),
  );

const updatePlacementForResource = (
  ctx: WorkbenchModuleContributionContext,
  input: { widgetId: string; resource: ResourceRef; title?: string; pinned?: boolean },
) => {
  for (const region of Object.values(ctx.layout.getLayout().regions)) {
    const placement = region.widgets.find(
      (candidate) => candidate.contributionId === input.widgetId && candidate.resourceUri === input.resource.uri,
    );
    if (placement) {
      ctx.layout.updateWidgetPlacement(placement.widgetId, {
        resource: input.resource,
        title: input.title,
        pinned: input.pinned,
      });
      return true;
    }
  }

  return false;
};

const parentResourceFor = (input: { kind: string; metadata: DashboardExtensionMetadata; projectId: string }) => {
  const parentRenderer = input.metadata.dataRenderers?.find((record) => record.resourceKind === input.kind);
  return parentRenderer ? createExtensionDataRendererResource(parentRenderer, input.projectId) : undefined;
};

const resourceMetadataString = (resource: ResourceRef, key: string) => {
  const value = resource.metadata?.[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
};

const resourceIconFor = (ctx: WorkbenchModuleContributionContext, resource: ResourceRef) =>
  resource.icon ?? ctx.resources.getKind(resource.kind)?.icon;

const parentTicketResourceFor = (
  ctx: WorkbenchModuleContributionContext,
  input: { kind: string; projectId: string; resource: ResourceRef },
): ResourceRef | undefined => {
  const id = resourceMetadataString(input.resource, "parentTicketId");
  if (!id) return undefined;

  const label =
    resourceMetadataString(input.resource, "parentTicketLabel") ??
    resourceMetadataString(input.resource, "parentTicketShorthand") ??
    id;

  return {
    kind: input.kind,
    uri: `dashboard-workbench://${input.kind}/${encodeURIComponent(id)}`,
    id,
    label,
    icon: ctx.resources.getKind(input.kind)?.icon,
    metadata: { projectId: input.projectId },
  };
};

const withExtensionResourceContext = (
  resource: ResourceRef,
  input: { kind: string; metadata: DashboardExtensionMetadata; projectId: string },
) => {
  const parentResource = parentResourceFor(input);

  return {
    ...resource,
    metadata: {
      projectId: input.projectId,
      ...resource.metadata,
      ...(parentResource ? createWorkbenchSelectionResourceMetadata(parentResource) : {}),
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

  const parentTicketResource = parentTicketResourceFor(ctx, input);

  ctx.breadcrumbs.setItems([
    {
      title: parentResource.label,
      icon: parentResource.icon,
      resource: parentResource,
      onClick: () => void ctx.resources.openResource(parentResource, { replaceActive: true }),
    },
    ...(parentTicketResource
      ? [
          {
            title: parentTicketResource.label ?? parentTicketResource.id ?? input.kind,
            icon: resourceIconFor(ctx, parentTicketResource),
            resource: parentTicketResource,
            onClick: () => void ctx.resources.openResource(parentTicketResource, { replaceActive: true }),
          },
        ]
      : []),
    {
      title: input.resource.label ?? input.resource.id ?? input.kind,
      icon: resourceIconFor(ctx, input.resource),
      resource: input.resource,
    },
  ]);
};

const removeManagedCompanions = (
  ctx: WorkbenchModuleContributionContext,
  managedWidgetIds: Set<string>,
  keepWidgetIds = new Set<string>(),
) => {
  for (const region of Object.values(ctx.layout.getLayout().regions)) {
    for (const placement of region.widgets) {
      if (!managedWidgetIds.has(placement.contributionId) || keepWidgetIds.has(placement.contributionId)) continue;
      ctx.layout.removeWidgetPlacement(placement.widgetId);
    }
  }
};

const openResourceViewGroup = (
  ctx: WorkbenchModuleContributionContext,
  input: {
    group: ResourceEditorGroup;
    openInput: { replaceActive?: boolean };
    resource: ResourceRef;
    resourceMode?: ExtensionModeRecord;
  },
) => {
  const { group, openInput, resource, resourceMode } = input;
  const placement = ctx.layout.openWidget(widgetIdFor(group.primary), {
    resource,
    title: resource.label,
    replaceActive: openInput.replaceActive,
  });

  openResourceCompanionViews(ctx, { companions: group.companions, resource, resourceMode });

  ctx.layout.activateWidget(placement.widgetId);

  return placement;
};

const openResourceCompanionViews = (
  ctx: WorkbenchModuleContributionContext,
  input: {
    companions: ExtensionViewRecord[];
    resource: ResourceRef;
    resourceMode?: ExtensionModeRecord;
  },
) => {
  const { companions, resource, resourceMode } = input;

  // replaceActive keeps a single companion in its region as the user switches
  // resources instead of stacking a new panel per open.
  for (const companion of companions) {
    const modeEntry = resourceModeEntryForView(companion, resourceMode);
    const region = companionViewRegion(companion, modeEntry);
    const widgetId = widgetIdFor(companion);
    const title = companionViewTitle(companion, resource, region);
    const updateInput = {
      resource,
      region,
      pinned: modeEntry?.pinned,
      title,
      replaceActive: true,
    };

    if (hasPlacementForResource(ctx, widgetId, resource)) {
      ctx.layout.openWidget(widgetId, { resource, region, pinned: modeEntry?.pinned, title });
      continue;
    }

    ctx.layout.openWidget(widgetId, updateInput);
  }
};

// A view that declares a `resourceKind` is the primary view for that kind. Opening a domain
// resource of that kind mounts the primary extension webview in the main region, plus any
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
          const resourceMode = resourceModeFor(input.metadata, kind);
          const expectedCompanionWidgetIds = new Set(companions.map(widgetIdFor));
          const selectedResource = withExtensionResourceContext(resource, {
            kind,
            metadata: input.metadata,
            projectId: input.projectId,
          });
          ctx.modes.setActiveMode(resourceMode?.modeId ?? "project");
          setExtensionResourceBreadcrumb(ctx, {
            kind,
            metadata: input.metadata,
            projectId: input.projectId,
            resource: selectedResource,
          });
          removeManagedCompanions(ctx, managedCompanionWidgetIds, expectedCompanionWidgetIds);
          return openResourceViewGroup(ctx, {
            group: { kind, primary, companions },
            openInput,
            resource: selectedResource,
            resourceMode,
          });
        },
      }),
    );
  }

  // Tracks the editor resource currently in the primary region so the command feed can
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
      const group = groupByKind.get(activeResource.kind);
      if (!group || !resourceGroupOwnsEvent(group, event)) return;
      if (outcomeValueId(event.outcome.value) !== activeResource.id) return;

      const label = resourceLabelFromOutcomeValue(event.outcome.value);
      if (!label || label === activeResource.label) return;

      activeResource.label = label;
      setExtensionResourceBreadcrumb(ctx, {
        kind: activeResource.kind,
        metadata: input.metadata,
        projectId: input.projectId,
        resource: activeResource,
      });
      updatePlacementForResource(ctx, {
        widgetId: widgetIdFor(group.primary),
        resource: activeResource,
        title: activeResource.label,
      });

      const resourceMode = resourceModeFor(input.metadata, activeResource.kind);
      for (const companion of group.companions) {
        const modeEntry = resourceModeEntryForView(companion, resourceMode);
        const region = companionViewRegion(companion, modeEntry);
        updatePlacementForResource(ctx, {
          widgetId: widgetIdFor(companion),
          resource: activeResource,
          title: companionViewTitle(companion, activeResource, region),
          pinned: modeEntry?.pinned,
        });
      }
    }),
  });

  return disposables;
};
