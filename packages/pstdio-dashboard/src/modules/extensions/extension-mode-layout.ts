import type { Disposable, WorkbenchModuleContext } from "@pstdio/workbench";
import { registerWorkbenchExtensionPanel } from "@pstdio/workbench/extensions";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { resolveLocalizableString } from "@/shared/extensions/extension-localization";
import type { DashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";
import { activateModeChromeContributions } from "@/shared/workbench/contributions/mode-chrome-contributions";
import {
  dashboardExtensionViewKind,
  extensionModeLayoutRegion,
  extensionViewRegion as extensionViewRegionForPlacement,
  extensionViewWidgetId,
  extensionViewWidgetIdFor,
} from "./extension-view-placement";

export { extensionViewRegion } from "./extension-view-placement";

type DashboardExtensionMode = DashboardExtensionMetadata["modes"][number];
type DashboardExtensionPanel = DashboardExtensionMetadata["panels"][number];
type ModeLayoutOpenEntry = NonNullable<NonNullable<DashboardExtensionMode["layout"]>["open"]>[number];

const nativeModeResourceKinds = new Map([["sessions", { kind: "session", label: "Session", icon: "MessageCircle" }]]);

const createExtensionViewResource = (input: {
  projectId: string;
  panel: DashboardExtensionPanel;
  title?: ModeLayoutOpenEntry["title"];
}) => ({
  kind: dashboardExtensionViewKind,
  uri: `dashboard-workbench://project/${input.projectId}/extension-views/${input.panel.id}`,
  id: input.panel.id,
  label: input.title
    ? resolveLocalizableString(input.title, input.panel.extensionId)
    : resolveLocalizableString(input.panel.title, input.panel.extensionId),
  // The renderer derives which view to mount from the resource kind + cached manifest
  // (PS-11), so the view record is not stored on the resource. projectId stays — it is
  // domain-adjacent context the renderer needs to look the manifest up.
  metadata: {
    extensionId: input.panel.extensionId,
    projectId: input.projectId,
  },
});

const resolveResource = (ctx: WorkbenchModuleContext, resource: string) =>
  ctx.resources.listResources("").find((entry) => entry.resource.uri === resource || entry.resource.id === resource)
    ?.resource;

const seedModeEntry = (input: {
  ctx: WorkbenchModuleContext;
  entry: ModeLayoutOpenEntry;
  projectId: string;
  panelById: Map<string, DashboardExtensionPanel>;
}) => {
  const { ctx, entry, projectId, panelById } = input;
  const region = extensionModeLayoutRegion(entry.region);

  if (entry.panel) {
    const panel = panelById.get(entry.panel);
    if (!panel) throw new Error(`Extension mode panel not found: ${entry.panel}`);
    return ctx.layout.openPanel(extensionViewWidgetIdFor(panel), {
      region,
      pinned: entry.pinned,
      resource: createExtensionViewResource({ projectId, title: entry.title, panel }),
      title: entry.title
        ? resolveLocalizableString(entry.title, panel.extensionId)
        : resolveLocalizableString(panel.title, panel.extensionId),
    });
  }

  if (!entry.resource) return undefined;
  const resource = resolveResource(ctx, entry.resource);
  if (!resource) throw new Error(`Extension mode resource not found: ${entry.resource}`);
  return ctx.resources.openResource(resource);
};

const isResourceBoundModeEntry = (
  entry: ModeLayoutOpenEntry,
  mode: DashboardExtensionMode,
  panelById: Map<string, DashboardExtensionPanel>,
) => Boolean(entry.panel && mode.resourceKind && panelById.get(entry.panel)?.resourceKind === mode.resourceKind);

export const activateExtensionModeLayout = (input: {
  ctx: WorkbenchModuleContext;
  metadata: DashboardExtensionMetadata;
  mode: DashboardExtensionMode;
  projectId: string;
}) => {
  const { ctx, metadata, mode, projectId } = input;
  const panelById = new Map(metadata.panels.map((panel) => [panel.id, panel]));
  const entries = mode.layout?.open ?? [];

  for (const entry of entries) {
    if (entry.panel && !panelById.has(entry.panel)) throw new Error(`Extension mode panel not found: ${entry.panel}`);
    if (entry.resource && !resolveResource(ctx, entry.resource)) {
      throw new Error(`Extension mode resource not found: ${entry.resource}`);
    }
  }

  for (const entry of entries) {
    if (isResourceBoundModeEntry(entry, mode, panelById)) continue;
    seedModeEntry({ ctx, entry, projectId, panelById });
  }
};

// Modal views mount in the overlay region as a closable dialog instead of docking
// into a workbench region; kanban-renderer create flows open them over the board.
const modalOverlayConfig = {
  size: "lg",
  placement: "center",
  scrollBehavior: "inside",
  closeOnEscape: false,
  closeOnInteractOutside: false,
  modal: true,
  preventScroll: true,
  trapFocus: true,
} as const;

const getModeIdsByViewId = (metadata: DashboardExtensionMetadata) => {
  const modeIdsByViewId = new Map<string, string[]>();

  for (const mode of metadata.modes) {
    for (const entry of mode.layout?.open ?? []) {
      if (!entry.panel) continue;
      const modeIds = modeIdsByViewId.get(entry.panel) ?? [];
      modeIdsByViewId.set(entry.panel, [...modeIds, mode.modeId]);
    }
  }

  return modeIdsByViewId;
};

const registerExtensionViews = (
  ctx: WorkbenchModuleContext,
  metadata: DashboardExtensionMetadata,
  projectId: string,
) => {
  const disposables: Disposable[] = [];
  const modeIdsByViewId = getModeIdsByViewId(metadata);

  for (const panel of metadata.panels) {
    if (!panel.webview) continue;
    const modeIds = modeIdsByViewId.get(panel.id);
    const isModeLocation = panel.region === "main" && Boolean(modeIds?.length);
    const eligibleModeIds = isModeLocation ? undefined : modeIds;
    let resourceKinds: string[] | undefined;
    if (panel.resourceKind) resourceKinds = [panel.resourceKind];
    else if (isModeLocation) resourceKinds = [dashboardExtensionViewKind];
    disposables.push(
      registerWorkbenchExtensionPanel({
        workbench: ctx,
        contribution: {
          id: extensionViewWidgetId(panel.id),
          title: resolveLocalizableString(panel.title, panel.extensionId),
          region: extensionViewRegionForPlacement(panel.region),
          closable: panel.closable,
          rendererId: dashboardWidgetIds.extensionView,
          config: { ...(panel.region === "overlay" ? modalOverlayConfig : {}), projectId },
          resourceKinds,
          eligibleLocations:
            eligibleModeIds || panel.eligibleLocations
              ? {
                  modeIds: eligibleModeIds,
                  resourceKinds: panel.eligibleLocations?.resourceKinds
                    ? [...panel.eligibleLocations.resourceKinds]
                    : undefined,
                }
              : undefined,
          panelMenus: panel.panelMenus?.map((menu) => ({
            id: extensionViewWidgetId(menu.id),
            title: resolveLocalizableString(menu.title, menu.extensionId),
            side: menu.side,
            rendererId: dashboardWidgetIds.extensionView,
            config: { projectId },
          })),
        },
      }),
    );
  }

  return disposables;
};

const registerExtensionModes = (
  ctx: WorkbenchModuleContext,
  metadata: DashboardExtensionMetadata,
  projectId: string,
) => {
  const disposables: Disposable[] = [];

  for (const mode of metadata.modes) {
    const resourceKind = nativeModeResourceKinds.get(mode.modeId);
    if (resourceKind && !ctx.resources.getKind(resourceKind.kind)) {
      disposables.push(ctx.resources.registerKind(resourceKind));
    }

    if (!ctx.modes.getMode(mode.modeId)) {
      disposables.push(
        ctx.modes.registerMode({
          id: mode.modeId,
          label: resolveLocalizableString(mode.label, mode.extensionId),
          panels: mode.layout?.panels,
          activate: () => undefined,
          seed(modeCtx) {
            activateExtensionModeLayout({ ctx: modeCtx, metadata, mode, projectId });
          },
          enter: (modeCtx) => activateModeChromeContributions(modeCtx, mode.modeId),
        }),
      );
    }
  }

  return disposables;
};

export const registerExtensionModeContributions = (
  ctx: WorkbenchModuleContext,
  metadata: DashboardExtensionMetadata,
  projectId: string,
) => [...registerExtensionViews(ctx, metadata, projectId), ...registerExtensionModes(ctx, metadata, projectId)];
