import type { Disposable, ResourceRef, WorkbenchModuleContext } from "@pstdio/workbench";
import { selectDashboardNavigationResource } from "@/shared/app/navigation-state";
import { executeExtensionCommand } from "@/shared/extensions/api";
import { resolveLocalizableString } from "@/shared/extensions/extension-localization";
import { subscribeToExtensionCommandFeed } from "@/shared/extensions/extension-webview-broadcast";
import type { DashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";
import { setResourceBreadcrumb, updateResourceBreadcrumbLabel } from "@/shared/workbench/resource-sync";
import type { ExecuteDashboardExtensionCommand } from "./extension-command-handler";
import { isSidenavResourceTree, type ResourcePanelBinding } from "./extension-composition";
import { groupResourceEditorViews, type ResourceEditorGroup } from "./extension-resource-editor-grouping";
import { resourceFromQueryValue } from "./extension-resource-query";

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

const widgetIdFor = (binding: ResourcePanelBinding) => binding.panel.id;

const companionViewTitle = (binding: ResourcePanelBinding, resource: ResourceRef) =>
  binding.region === "sidenav" || binding.region === "main-left-menu"
    ? (resource.label ?? binding.panel.title)
    : binding.panel.title;

const panelMenuWidgetIdFor = (menu: NonNullable<ExtensionPanelRecord["panelMenus"]>[number]) => menu.id;

const resourceGroupOwnsEvent = (group: ResourceEditorGroup, event: { extensionId: string }) =>
  group.primary?.panel.extensionId === event.extensionId ||
  group.companions.some((companion) => companion.panel.extensionId === event.extensionId);

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

const updateResourceGroupTitles = (ctx: WorkbenchModuleContext, group: ResourceEditorGroup, resource: ResourceRef) => {
  if (group.primary) {
    updatePlacementForResource(ctx, {
      panelId: widgetIdFor(group.primary),
      resource,
      title: resource.label,
    });
    for (const menu of group.primary.panel.panelMenus ?? []) {
      updatePlacementForResource(ctx, {
        panelId: panelMenuWidgetIdFor(menu),
        resource,
        title: menu.side === "left" ? resource.label : resolveLocalizableString(menu.title, menu.extensionId),
        pinned: true,
      });
    }
  }

  for (const companion of group.companions) {
    if (isSidenavResourceTree(companion)) continue;
    updatePlacementForResource(ctx, {
      panelId: widgetIdFor(companion),
      resource,
      title: companionViewTitle(companion, resource),
      pinned: companion.pinned,
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
      // A panel id alone does not say who placed the panel: the same panel can be a
      // companion of one resource and a mode-wide panel of the current mode. Only a
      // placement opened for a resource is a companion, so leave the rest alone.
      if (!placement.resourceUri) continue;
      ctx.layout.removeWidgetPlacement(placement.widgetId);
    }
  }
};

const openResourceCompanionViews = (
  ctx: WorkbenchModuleContext,
  input: { companions: ResourcePanelBinding[]; resource: ResourceRef },
) => {
  const placements = [];

  for (const companion of input.companions) {
    if (isSidenavResourceTree(companion)) continue;

    // A companion is part of the resource's layout, not a peek at it, so it keeps its tab.
    placements.push(
      ctx.layout.openPanel(widgetIdFor(companion), {
        resource: input.resource,
        region: companion.region,
        role: companion.region === "main" ? "location" : "sub-panel",
        pinned: companion.pinned,
        closable: !companion.required,
        title: companionViewTitle(companion, input.resource),
        strategy: { kind: "persistent" },
      }),
    );
  }

  return placements;
};

const openResourceViewGroup = (
  ctx: WorkbenchModuleContext,
  input: {
    group: ResourceEditorGroup & { primary: ResourcePanelBinding };
    openInput: { replaceActive?: boolean };
    resource: ResourceRef;
  },
) => {
  const placement = ctx.layout.openPanel(widgetIdFor(input.group.primary), {
    strategy: input.openInput.replaceActive ? { kind: "replace-active" } : { kind: "persistent" },
    resource: input.resource,
    region: input.group.primary.region,
    role: input.group.primary.region === "main" ? "location" : "sub-panel",
    pinned: input.group.primary.pinned,
    closable: !input.group.primary.required,
    title: input.resource.label,
  });

  openResourceCompanionViews(ctx, { companions: input.group.companions, resource: input.resource });

  ctx.layout.activatePanel(placement.instanceId);

  return placement;
};

// A side-only kind opens as an inspector: the Side Panel shows the bound views while the
// current mode, main content, and navigation all stay in place.
const openResourceInspectorGroup = (
  ctx: WorkbenchModuleContext,
  input: { companions: ResourcePanelBinding[]; resource: ResourceRef },
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

// Resource-panel edges bind a resource kind to the panels that present it. Opening a
// domain resource of that kind mounts the panel the mode recipe places in `main`, plus
// the companion panels (e.g. a properties panel) bound to the same resource. The domain
// resource stays the navigable identity — the renderer derives which view to mount from
// the resource kind + cached manifest (PS-11), so no renderer metadata is on the resource.
export const registerExtensionResourceView = (
  ctx: WorkbenchModuleContext,
  input: {
    metadata: DashboardExtensionMetadata;
    projectId: string;
    resourceKinds?: readonly string[];
    executeCommand?: ExecuteDashboardExtensionCommand;
  },
) => {
  const disposables: Disposable[] = [];
  const executeCommand = input.executeCommand ?? executeExtensionCommand;
  const groupOptions = { resourceKinds: input.resourceKinds };
  const groups = groupResourceEditorViews(input.metadata, groupOptions);
  const groupByKind = new Map(groups.map((group) => [group.kind, group]));
  const allGroups = [undefined, ...input.metadata.modes.map((mode) => mode.modeId)].flatMap((modeId) =>
    groupResourceEditorViews(input.metadata, { ...groupOptions, modeId }),
  );
  const managedCompanionWidgetIds = new Set(allGroups.flatMap((group) => group.companions.map(widgetIdFor)));
  const groupForKind = (kind: string) =>
    groupResourceEditorViews(input.metadata, {
      modeId: ctx.modes.getActiveModeId(),
      resourceKinds: [kind],
    })[0] ?? groupByKind.get(kind);

  for (const baseGroup of groups) {
    const { kind } = baseGroup;
    if (!baseGroup.primary) {
      const inspector = baseGroup.companions.find((companion) => companion.region === "side");
      if (!ctx.resources.getKind(kind)) {
        disposables.push(
          ctx.resources.registerKind({
            kind,
            label: inspector ? resolveLocalizableString(inspector.panel.title, inspector.panel.extensionId) : kind,
            icon: inspector?.panel.icon,
          }),
        );
      }
    }

    disposables.push(
      ctx.resources.registerPresenter({
        id: baseGroup.primary
          ? `dashboard.extensions.resource-view.${kind}`
          : `dashboard.extensions.resource-inspector.${kind}`,
        priority: 1100,
        canOpen: (resource) => resource.kind === kind,
        open: (resource, openInput) => {
          const group = groupForKind(kind);
          if (!group) throw new Error(`No panel group registered for resource kind: ${kind}`);
          const expectedCompanionWidgetIds = new Set(
            group.companions.filter((companion) => !isSidenavResourceTree(companion)).map(widgetIdFor),
          );
          const selectedResource = withExtensionResourceContext(resource, { projectId: input.projectId });
          removeManagedCompanions(ctx, managedCompanionWidgetIds, expectedCompanionWidgetIds);
          if (!group.primary) {
            return openResourceInspectorGroup(ctx, { companions: group.companions, resource: selectedResource });
          }
          // Opening a resource never infers a mode: it keeps the workbench the user is
          // in, so the project's own chrome stays put and the resource's panels land in
          // the regions they support.
          selectDashboardNavigationResource(ctx, selectedResource);
          setResourceBreadcrumb(ctx, selectedResource);
          return openResourceViewGroup(ctx, {
            group: { ...group, primary: group.primary },
            openInput,
            resource: selectedResource,
          });
        },
      }),
    );
  }

  // Tracks the editor resource currently in the primary region so the command feed can
  // refresh just its breadcrumb when a save changes the display title.
  let activeResource: ResourceRef | undefined;

  const refreshActiveResource = async (rendererId: string) => {
    const current = activeResource;
    if (!current?.id) return;
    const renderer = input.metadata.kanbanRenderers?.find(
      (candidate) => candidate.id === rendererId && candidate.resourceKind === current.kind,
    );
    if (!renderer) return;

    const response = await executeCommand(input.projectId, renderer.queryHandlerId, { params: {} });
    if (!response.outcome.ok || activeResource !== current) return;
    const refreshed = resourceFromQueryValue(response.outcome.value, current.id, input.projectId);
    if (!refreshed || refreshed.kind !== current.kind) return;

    current.label = refreshed.label;
    current.icon = refreshed.icon;
    current.metadata = refreshed.metadata;
    setResourceBreadcrumb(ctx, current);
    const group = groupForKind(current.kind);
    if (group) updateResourceGroupTitles(ctx, group, current);
    ctx.lastResource.set(current);
  };

  disposables.push(
    ctx.onDidChangePrimaryResource((resource) => {
      const group = resource ? groupForKind(resource.kind) : undefined;
      activeResource = group ? resource : undefined;

      if (managedCompanionWidgetIds.size > 0) {
        const keepWidgetIds = group
          ? new Set(group.companions.filter((companion) => !isSidenavResourceTree(companion)).map(widgetIdFor))
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
      const group = groupForKind(activeResource.kind);
      if (!group || !resourceGroupOwnsEvent(group, event)) return;
      if (outcomeValueId(event.outcome.value) !== activeResource.id) return;

      const label = resourceLabelFromOutcomeValue(event.outcome.value);
      if (!label || label === activeResource.label) return;

      activeResource.label = label;
      updateResourceBreadcrumbLabel(ctx, activeResource);
      updateResourceGroupTitles(ctx, group, activeResource);
      ctx.lastResource.set(activeResource);
    }),
  });

  disposables.push(
    ctx.renderers.onDidRefreshKanbanRenderer((event) => {
      void refreshActiveResource(event.kanbanRendererId).catch(() => undefined);
    }),
  );

  return disposables;
};
