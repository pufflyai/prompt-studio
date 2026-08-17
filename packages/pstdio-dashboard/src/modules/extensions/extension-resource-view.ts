import type { Disposable, ResourceRef, WorkbenchModuleContext } from "@pstdio/workbench";
import { selectDashboardNavigationResource } from "@/shared/app/navigation-state";
import { resolveLocalizableString } from "@/shared/extensions/extension-localization";
import { subscribeToExtensionCommandFeed } from "@/shared/extensions/extension-webview-broadcast";
import type { DashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";
import { setResourceBreadcrumb } from "@/shared/workbench/resource-sync";
import { groupResourceEditorViews, type ResourceEditorGroup } from "./extension-resource-editor-grouping";
import { extensionModeLayoutRegion, extensionViewRegion, extensionViewWidgetIdFor } from "./extension-view-placement";

const outcomeValueId = (value: unknown) => {
  if (!value || typeof value !== "object") return undefined;
  const id = (value as { id?: unknown }).id;
  return typeof id === "string" ? id : undefined;
};

// Re-derives a resource's display label from a command outcome, mirroring the dashboard's
// existing `[shorthand, title]` convention (see extension-kanban-renderers onAfterCreate).
const resourceLabelFromOutcomeValue = (value: unknown) => {
  if (!value || typeof value !== "object") return undefined;
  const record = value as { shorthand?: unknown; title?: unknown; label?: unknown };
  const composed = [record.shorthand, record.title]
    .filter((part): part is string => typeof part === "string" && part.length > 0)
    .join(" ");
  if (composed) return composed;
  return typeof record.label === "string" && record.label ? record.label : undefined;
};

type ExtensionPanelRecord = DashboardExtensionMetadata["panels"][number];
type ExtensionModeRecord = DashboardExtensionMetadata["modes"][number];
type ModeLayoutOpenEntry = NonNullable<NonNullable<ExtensionModeRecord["layout"]>["open"]>[number];

const widgetIdFor = (panel: ExtensionPanelRecord) => extensionViewWidgetIdFor(panel);

const companionViewTitle = (panel: ExtensionPanelRecord, resource: ResourceRef, region: string) =>
  region === "sidenav" || region === "main-left-menu" ? (resource.label ?? panel.title) : panel.title;

const panelMenuWidgetIdFor = (menu: NonNullable<ExtensionPanelRecord["panelMenus"]>[number]) =>
  menu.webview ? extensionViewWidgetIdFor(menu) : menu.id;

const resourceModeFor = (metadata: DashboardExtensionMetadata, kind: string) =>
  metadata.modes.find((mode) => mode.resourceKind === kind);

const resourceModeEntryForView = (panel: ExtensionPanelRecord, resourceMode: ExtensionModeRecord | undefined) => {
  if (!resourceMode || resourceMode.resourceKind !== panel.resourceKind) return undefined;
  return resourceMode.layout?.open?.find((entry) => entry.panel === panel.id);
};

const resourceGroupOwnsEvent = (group: ResourceEditorGroup, event: { extensionId: string }) =>
  group.primary?.extensionId === event.extensionId ||
  group.companions.some((companion) => companion.extensionId === event.extensionId);

const companionViewRegion = (panel: ExtensionPanelRecord, modeEntry: ModeLayoutOpenEntry | undefined) =>
  modeEntry ? extensionModeLayoutRegion(modeEntry.region) : extensionViewRegion(panel.region);

const isResourceSidenavCompanion = (panel: ExtensionPanelRecord, resourceMode: ExtensionModeRecord | undefined) =>
  Boolean(
    panel.renderer?.kind === "tree" &&
      companionViewRegion(panel, resourceModeEntryForView(panel, resourceMode)) === "sidenav",
  );

const updatePlacementForResource = (
  ctx: WorkbenchModuleContext,
  input: { panelId: string; resource: ResourceRef; title?: string; pinned?: boolean },
) => {
  for (const region of Object.values(ctx.layout.getLayout().regions)) {
    const placement = region.widgets.find(
      (candidate) => candidate.contributionId === input.panelId && candidate.resourceUri === input.resource.uri,
    );
    if (placement) {
      ctx.layout.updatePanel(placement.widgetId, {
        resource: input.resource,
        title: input.title,
        pinned: input.pinned,
      });
      return true;
    }
  }

  return false;
};

const withExtensionResourceContext = (resource: ResourceRef, input: { projectId: string }) => {
  return {
    ...resource,
    metadata: {
      projectId: input.projectId,
      ...resource.metadata,
    },
  };
};

const updateResourceGroupTitles = (
  ctx: WorkbenchModuleContext,
  group: ResourceEditorGroup,
  metadata: DashboardExtensionMetadata,
  resource: ResourceRef,
) => {
  if (group.primary) {
    updatePlacementForResource(ctx, {
      panelId: widgetIdFor(group.primary),
      resource,
      title: resource.label,
    });
    for (const menu of group.primary.panelMenus ?? []) {
      updatePlacementForResource(ctx, {
        panelId: panelMenuWidgetIdFor(menu),
        resource,
        title: menu.side === "left" ? resource.label : resolveLocalizableString(menu.title, menu.extensionId),
        pinned: true,
      });
    }
  }

  const resourceMode = resourceModeFor(metadata, resource.kind);
  for (const companion of group.companions) {
    if (isResourceSidenavCompanion(companion, resourceMode)) continue;
    const modeEntry = resourceModeEntryForView(companion, resourceMode);
    const region = companionViewRegion(companion, modeEntry);
    updatePlacementForResource(ctx, {
      panelId: widgetIdFor(companion),
      resource,
      title: companionViewTitle(companion, resource, region),
      pinned: modeEntry?.pinned,
    });
  }
};

const removeManagedCompanions = (
  ctx: WorkbenchModuleContext,
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
  ctx: WorkbenchModuleContext,
  input: {
    group: ResourceEditorGroup & { primary: ExtensionPanelRecord };
    openInput: { replaceActive?: boolean };
    resource: ResourceRef;
    resourceMode?: ExtensionModeRecord;
  },
) => {
  const { group, openInput, resource, resourceMode } = input;
  const placement = ctx.layout.openPanel(widgetIdFor(group.primary), {
    strategy: openInput.replaceActive ? { kind: "replace-active" } : { kind: "persistent" },
    resource,
    title: resource.label,
  });

  openResourceCompanionViews(ctx, { companions: group.companions, resource, resourceMode });

  ctx.layout.activatePanel(placement.instanceId);

  return placement;
};

const openResourceCompanionViews = (
  ctx: WorkbenchModuleContext,
  input: {
    companions: ExtensionPanelRecord[];
    resource: ResourceRef;
    resourceMode?: ExtensionModeRecord;
  },
) => {
  const { companions, resource, resourceMode } = input;
  const placements = [];

  for (const companion of companions) {
    const modeEntry = resourceModeEntryForView(companion, resourceMode);
    const region = companionViewRegion(companion, modeEntry);
    if (isResourceSidenavCompanion(companion, resourceMode)) continue;
    const widgetId = widgetIdFor(companion);
    const title = companionViewTitle(companion, resource, region);

    // A companion is part of the resource's layout, not a peek at it, so it keeps its tab.
    placements.push(
      ctx.layout.openPanel(widgetId, {
        resource,
        region,
        pinned: modeEntry?.pinned,
        title,
        strategy: { kind: "persistent" },
      }),
    );
  }

  return placements;
};

// A side-only kind opens as an inspector: the Side Panel shows the bound views while the
// current mode, main content, and navigation all stay in place.
const openResourceInspectorGroup = (
  ctx: WorkbenchModuleContext,
  input: {
    companions: ExtensionPanelRecord[];
    resource: ResourceRef;
    resourceMode?: ExtensionModeRecord;
  },
) => {
  ctx.panels.setOpen("side", true);
  ctx.layout.setRegionVisible("side", true);
  ctx.sidePanel.setMode("attached");
  const placements = openResourceCompanionViews(ctx, input);
  const active = placements.at(-1);
  if (!active) throw new Error(`No inspector panel opened for resource kind: ${input.resource.kind}`);
  ctx.layout.activatePanel(active.instanceId);
  return active;
};

// A view that declares a `resourceKind` is the primary view for that kind. Opening a domain
// resource of that kind mounts the primary extension webview in the main region, plus any
// companion side-panel views (e.g. a properties panel) bound to the same resource. The domain
// resource stays the navigable identity — the renderer derives which view to mount from the
// resource kind + cached manifest (PS-11), so no renderer metadata is stored on the resource.
export const registerExtensionResourceView = (
  ctx: WorkbenchModuleContext,
  input: { metadata: DashboardExtensionMetadata; projectId: string },
) => {
  const disposables: Disposable[] = [];
  const groups = groupResourceEditorViews(input.metadata.panels);
  const groupByKind = new Map(groups.map((group) => [group.kind, group]));
  const managedCompanionWidgetIds = new Set(groups.flatMap((group) => group.companions.map(widgetIdFor)));

  for (const { kind, primary, companions } of groups) {
    if (!primary) {
      const inspector = companions.find((companion) => companion.region === "side");
      if (!ctx.resources.getKind(kind)) {
        disposables.push(
          ctx.resources.registerKind({
            kind,
            label: inspector ? resolveLocalizableString(inspector.title, inspector.extensionId) : kind,
            icon: inspector?.icon,
          }),
        );
      }
      disposables.push(
        ctx.resources.registerPresenter({
          id: `dashboard.extensions.resource-inspector.${kind}`,
          priority: 1100,
          canOpen: (resource) => resource.kind === kind,
          open: (resource) => {
            const resourceMode = resourceModeFor(input.metadata, kind);
            const selectedResource = withExtensionResourceContext(resource, { projectId: input.projectId });
            removeManagedCompanions(ctx, managedCompanionWidgetIds, new Set(companions.map(widgetIdFor)));
            return openResourceInspectorGroup(ctx, { companions, resource: selectedResource, resourceMode });
          },
        }),
      );
      continue;
    }

    disposables.push(
      ctx.resources.registerPresenter({
        id: `dashboard.extensions.resource-view.${kind}`,
        priority: 1100,
        canOpen: (resource) => resource.kind === kind,
        open: (resource, openInput) => {
          const resourceMode = resourceModeFor(input.metadata, kind);
          const expectedCompanionWidgetIds = new Set(
            companions.filter((companion) => !isResourceSidenavCompanion(companion, resourceMode)).map(widgetIdFor),
          );
          const selectedResource = withExtensionResourceContext(resource, { projectId: input.projectId });
          selectDashboardNavigationResource(ctx, selectedResource, {
            modeId: resourceMode?.modeId ?? "project",
          });
          setResourceBreadcrumb(ctx, selectedResource);
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
        const resourceMode = resource ? resourceModeFor(input.metadata, resource.kind) : undefined;
        const keepWidgetIds = group
          ? new Set(
              group.companions
                .filter((companion) => !isResourceSidenavCompanion(companion, resourceMode))
                .map(widgetIdFor),
            )
          : undefined;
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
      setResourceBreadcrumb(ctx, activeResource);
      updateResourceGroupTitles(ctx, group, input.metadata, activeResource);
    }),
  });

  return disposables;
};
