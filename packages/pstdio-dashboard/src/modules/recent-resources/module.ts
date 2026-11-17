import {
  isNavigationTarget,
  type NavigationTarget,
  type PageLocation,
  type ResourceRef,
  resourceKey,
  workbenchCommands,
} from "@pstdio/sdk/extensions";
import type { WorkbenchModuleContext, WorkbenchModuleContribution } from "@pstdio/workbench";
import { resolveEventReferenceId, viewDataEvents } from "pstdio-api-contracts/extension-kernel";
import { publishExtensionEvent } from "@/shared/extensions/extension-webview-broadcast";
import { canonicalDashboardPageTarget, canonicalDashboardResource } from "@/shared/extensions/resource-identity";

interface RecentResource {
  resource: ResourceRef;
  target: Extract<NavigationTarget, { kind: "page" | "compound" }>;
}
const preference = "workbench.recentResources";
const pageTarget = (location: PageLocation): Extract<NavigationTarget, { kind: "page" }> => {
  const { parent, ...page } = location;
  return { ...page, kind: "page", ...(parent ? { parent: pageTarget(parent) } : {}) };
};
// Recents cross extension bridges: a bare core resource must retain its original
// owner instead of being qualified to the extension that displays the shortcut.
const canonicalDestination = (target: Extract<NavigationTarget, { kind: "page" | "panel" }>, projectId: string) => {
  if (target.kind === "page") return canonicalDashboardPageTarget(target, projectId);
  return {
    ...target,
    ...(target.resource ? { resource: canonicalDashboardResource(target.resource, projectId) } : {}),
  };
};
const canonicalTarget = (target: RecentResource["target"], projectId: string) =>
  target.kind === "page"
    ? canonicalDashboardPageTarget(target, projectId)
    : { ...target, targets: target.targets.map((target) => canonicalDestination(target, projectId)) };
const readSaved = (ctx: WorkbenchModuleContext, projectId: string): RecentResource[] => {
  const saved = ctx.preferences.getValue(preference, { scope: "project", scopeId: projectId });
  if (!saved || typeof saved !== "object" || !("items" in saved) || !Array.isArray(saved.items)) return [];
  return saved.items
    .filter((item): item is RecentResource =>
      Boolean(
        item &&
          typeof item === "object" &&
          item.resource &&
          typeof item.resource.type === "string" &&
          typeof item.resource.id === "string" &&
          (!item.resource.projectId || item.resource.projectId === projectId) &&
          (item.target?.kind === "page" || item.target?.kind === "compound") &&
          isNavigationTarget(item.target),
      ),
    )
    .map((item) => ({ ...item, target: canonicalTarget(item.target, projectId) }));
};
const available = (ctx: WorkbenchModuleContext, target: NavigationTarget): boolean => {
  if (target.kind === "compound") return target.targets.every((target) => available(ctx, target));
  if (target.kind === "page")
    return (
      (!target.parent || available(ctx, target.parent)) &&
      ctx.pages
        .listPages()
        .some((page) => page.ref.id === target.page.id && page.ref.extensionId === target.page.extensionId)
    );
  if (target.kind === "panel") {
    const panel = target.panel;
    if (panel.kind === "placement")
      return ctx.modePlacements
        .listPlacements()
        .some((placement) => placement.ref.id === panel.id && placement.ref.extensionId === panel.extensionId);
    return ctx.pages
      .listPages()
      .some(
        (page) =>
          page.ref.id === panel.page.id &&
          page.ref.extensionId === panel.page.extensionId &&
          page.slots.some((slot) => slot.id === panel.id),
      );
  }
  return false;
};

export const createRecentResourcesModule = () =>
  ({
    id: "dashboard.recent-resources",
    activate(ctx) {
      ctx.preferences.registerSchema({ properties: { [preference]: { type: "object", scope: "project" } } });
      const changed = (projectId = ctx.pages.store.getState().projectId) => {
        if (projectId)
          publishExtensionEvent({
            id: resolveEventReferenceId(viewDataEvents.recentResourcesChanged, "pstdio"),
            projectId,
          });
      };
      const save = (projectId: string, items: RecentResource[]) => {
        ctx.preferences.setValue(preference, { items }, { scope: "project", scopeId: projectId });
        changed(projectId);
      };
      const remember = (resource: ResourceRef | undefined, target: RecentResource["target"]) => {
        const projectId = ctx.pages.store.getState().projectId;
        if (
          !projectId ||
          !resource ||
          resource.type === "session-draft" ||
          (resource.projectId && resource.projectId !== projectId)
        )
          return;
        resource = canonicalDashboardResource(resource, projectId);
        const items = readSaved(ctx, projectId).filter((item) => resourceKey(item.resource) !== resourceKey(resource));
        void save(
          projectId,
          [
            {
              resource: { ...resource, projectId },
              target: canonicalTarget(target, projectId),
            },
            ...items,
          ].slice(0, 50),
        );
      };
      const rememberActive = (resource = ctx.getActiveResource()) => {
        const location = ctx.pages.store.getState().location;
        if (!resource || !location) return;
        resource = canonicalDashboardResource(resource, ctx.pages.store.getState().projectId!);
        if (
          resourceKey(resource) ===
          resourceKey(location.resource && canonicalDashboardResource(location.resource, resource.projectId!))
        )
          return remember(resource, pageTarget(location));
        const widget = Object.values(ctx.layout.getLayout().regions)
          .flatMap((region) => region.widgets)
          .find(
            (widget) =>
              resourceKey(widget.resource && canonicalDashboardResource(widget.resource, resource.projectId!)) ===
              resourceKey(resource),
          );
        const identity = widget?.placementIdentity;
        if (!identity || identity.kind === "shell") return;
        const panel =
          identity.kind === "mode"
            ? ctx.modePlacements.listPlacements().find((placement) => placement.id === identity.placementId)?.ref
            : { kind: "page-slot" as const, page: ctx.pages.getPage(identity.pageId)!.ref, id: identity.slotId };
        if (panel)
          remember(resource, { kind: "compound", targets: [pageTarget(location), { kind: "panel", panel, resource }] });
      };
      ctx.commands.registerCommand(
        { id: workbenchCommands.recentResources.id, label: "Read recent resources", category: "Project" },
        {
          execute: () => {
            const projectId = ctx.pages.store.getState().projectId;
            if (!projectId) throw new Error("Recent resources require a selected project");
            return readSaved(ctx, projectId)
              .flatMap((item) => {
                const kind = ctx.resources.getKind(item.resource.type, item.resource.extensionId);
                if (!kind || !available(ctx, item.target)) return [];
                const resource = kind.resolve ? kind.resolve(item.resource) : item.resource;
                return resource
                  ? [{ resource: { ...resource, icon: resource.icon ?? kind.icon }, target: item.target }]
                  : [];
              })
              .slice(0, 5);
          },
        },
      );
      // Owner refreshes update last-seen presentation without counting as another visit.
      const refreshReferences = () => {
        const state = ctx.pages.store.getState();
        if (!state.projectId) return;
        const resources = [
          state.location?.resource,
          ...Object.values(state.pageStates).flatMap((page) =>
            Object.values(page.resourceInstances)
              .flat()
              .map((instance) => instance.resource),
          ),
          ...Object.values(ctx.layout.getLayout().regions).flatMap((region) =>
            region.widgets.map((widget) => widget.resource),
          ),
        ].filter(
          (resource): resource is ResourceRef =>
            Boolean(resource) && (!resource!.projectId || resource!.projectId === state.projectId),
        );
        const current = new Map(
          resources.map((resource) => {
            const ref = canonicalDashboardResource(resource, state.projectId!);
            return [resourceKey(ref), ref];
          }),
        );
        const items = readSaved(ctx, state.projectId);
        let updated = false;
        const next = items.map((item) => {
          const resource = current.get(resourceKey(item.resource));
          if (!resource || JSON.stringify(resource) === JSON.stringify(item.resource)) return item;
          updated = true;
          return { ...item, resource };
        });
        if (updated) save(state.projectId, next);
      };
      const references = ctx.pages.store.subscribe((state, previous) => {
        refreshReferences();
        if (state.pages !== previous.pages) changed();
      });
      const layouts = ctx.layout.store.subscribe(refreshReferences);
      const kinds = ctx.resources.store.subscribe(() => changed());
      const placements = ctx.modePlacements.onDidChange(() => changed());
      const navigation = ctx.pageLocations.onDidNavigate((location) => {
        if (location.resource) remember(location.resource, pageTarget(location));
      });
      const opened = ctx.navigation.onDidOpenTarget((target) => {
        if (target.kind === "viewer") return rememberActive(target.resource);
        if (target.kind === "compound") {
          if (isNavigationTarget(target))
            target.targets.forEach((step) => {
              remember(step.resource, target);
            });
          return;
        }
        if (target.kind !== "panel" || target.panel.kind === "shell-placement") return;
        const location = ctx.pages.store.getState().location;
        if (!location) return;
        const panel: Extract<NavigationTarget, { kind: "panel" }> = {
          kind: "panel",
          panel: target.panel,
          resource: target.resource,
          open: target.open,
        };
        remember(target.resource, { kind: "compound", targets: [pageTarget(location), panel] });
      });
      const active = ctx.onDidChangeActiveResource(rememberActive);
      const removed = ctx.resources.onDidRemove((resource) => {
        const projectId = resource.projectId ?? ctx.pages.store.getState().projectId;
        if (projectId)
          void save(
            projectId,
            readSaved(ctx, projectId).filter(
              (item) => resourceKey(item.resource) !== resourceKey(canonicalDashboardResource(resource, projectId)),
            ),
          );
      });
      return [
        navigation,
        opened,
        active,
        removed,
        { dispose: references },
        { dispose: layouts },
        { dispose: kinds },
        placements,
      ];
    },
  }) satisfies WorkbenchModuleContribution;
