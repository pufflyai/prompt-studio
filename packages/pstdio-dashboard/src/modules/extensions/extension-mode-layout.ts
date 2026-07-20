import type { Disposable, WorkbenchModuleContributionContext } from "@pstdio/workbench/core";
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
type DashboardExtensionView = DashboardExtensionMetadata["views"][number];
type ModeLayoutOpenEntry = NonNullable<NonNullable<DashboardExtensionMode["layout"]>["open"]>[number];

const defaultResetTargets = [
  "workbench.left",
  "workbench.main.left",
  "workbench.main",
  "workbench.main.right",
  "workbench.secondary",
] as const satisfies readonly ModeLayoutOpenEntry["target"][];

const nativeModeResourceKinds = new Map([["sessions", { kind: "session", label: "Session", icon: "MessageCircle" }]]);

const createExtensionViewResource = (input: {
  projectId: string;
  view: DashboardExtensionView;
  title?: ModeLayoutOpenEntry["title"];
}) => ({
  kind: dashboardExtensionViewKind,
  uri: `dashboard-workbench://project/${input.projectId}/extension-views/${input.view.id}`,
  id: input.view.id,
  label: input.title
    ? resolveLocalizableString(input.title, input.view.extensionId)
    : resolveLocalizableString(input.view.title, input.view.extensionId),
  // The renderer derives which view to mount from the resource kind + cached manifest
  // (PS-11), so the view record is not stored on the resource. projectId stays — it is
  // domain-adjacent context the renderer needs to look the manifest up.
  metadata: {
    extensionId: input.view.extensionId,
    projectId: input.projectId,
  },
});

const resetTargets = (layout: DashboardExtensionMode["layout"] | undefined) => {
  if (!layout) return [];
  if (layout.reset === true) return [...defaultResetTargets];
  return Array.isArray(layout.reset) ? layout.reset : [];
};

const resolveResource = (ctx: WorkbenchModuleContributionContext, resource: string) =>
  ctx.resources.listResources("").find((entry) => entry.resource.uri === resource || entry.resource.id === resource)
    ?.resource;

const openModeEntry = (input: {
  ctx: WorkbenchModuleContributionContext;
  entry: ModeLayoutOpenEntry;
  projectId: string;
  viewById: Map<string, DashboardExtensionView>;
}) => {
  const { ctx, entry, projectId, viewById } = input;
  const region = extensionModeLayoutRegion(entry.target);

  if (entry.view) {
    const view = viewById.get(entry.view);
    if (!view) throw new Error(`Extension mode view not found: ${entry.view}`);
    return ctx.layout.openWidget(extensionViewWidgetIdFor(view), {
      region,
      pinned: entry.pinned,
      resource: createExtensionViewResource({ projectId, title: entry.title, view }),
      title: entry.title
        ? resolveLocalizableString(entry.title, view.extensionId)
        : resolveLocalizableString(view.title, view.extensionId),
    });
  }

  if (!entry.resource) return undefined;
  const resource = resolveResource(ctx, entry.resource);
  if (!resource) throw new Error(`Extension mode resource not found: ${entry.resource}`);
  if (entry.widget) {
    return ctx.layout.openWidget(entry.widget, {
      region,
      pinned: entry.pinned,
      resource,
      title: entry.title ?? resource.label,
    });
  }
  return ctx.resources.openResource(resource);
};

const isResourceBoundModeEntry = (
  entry: ModeLayoutOpenEntry,
  mode: DashboardExtensionMode,
  viewById: Map<string, DashboardExtensionView>,
) => Boolean(entry.view && mode.resourceKind && viewById.get(entry.view)?.resourceKind === mode.resourceKind);

export const activateExtensionModeLayout = (input: {
  ctx: WorkbenchModuleContributionContext;
  metadata: DashboardExtensionMetadata;
  mode: DashboardExtensionMode;
  projectId: string;
}) => {
  const { ctx, metadata, mode, projectId } = input;
  const viewById = new Map(metadata.views.map((view) => [view.id, view]));
  const entries = mode.layout?.open ?? [];

  for (const entry of entries) {
    if (entry.view && !viewById.has(entry.view)) throw new Error(`Extension mode view not found: ${entry.view}`);
    if (entry.resource && !entry.widget && !resolveResource(ctx, entry.resource)) {
      throw new Error(`Extension mode resource not found: ${entry.resource}`);
    }
  }

  for (const target of resetTargets(mode.layout)) ctx.layout.clearRegion(extensionModeLayoutRegion(target));
  for (const entry of entries) {
    if (isResourceBoundModeEntry(entry, mode, viewById)) continue;
    openModeEntry({ ctx, entry, projectId, viewById });
  }
};

// Modal views mount in the overlay region as a closable dialog instead of docking
// into a workbench region; data-renderer create flows open them over the board.
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

const registerExtensionViews = (ctx: WorkbenchModuleContributionContext, metadata: DashboardExtensionMetadata) => {
  const disposables: Disposable[] = [];

  for (const view of metadata.views) {
    if (!view.webview) continue;
    const isModal = view.surface === "modal";
    disposables.push(
      ctx.layout.registerWidget({
        id: extensionViewWidgetId(view.id),
        title: resolveLocalizableString(view.title, view.extensionId),
        region: isModal ? "overlay" : extensionViewRegionForPlacement(view.target),
        rendererId: dashboardWidgetIds.extensionView,
        ...(isModal ? { closable: true, config: modalOverlayConfig } : {}),
      }),
    );
  }

  return disposables;
};

const registerExtensionModes = (
  ctx: WorkbenchModuleContributionContext,
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
          activate(modeCtx) {
            activateExtensionModeLayout({ ctx: modeCtx, metadata, mode, projectId });
            return activateModeChromeContributions(modeCtx, mode.modeId);
          },
        }),
      );
    }
  }

  return disposables;
};

export const registerExtensionModeContributions = (
  ctx: WorkbenchModuleContributionContext,
  metadata: DashboardExtensionMetadata,
  projectId: string,
) => [...registerExtensionViews(ctx, metadata), ...registerExtensionModes(ctx, metadata, projectId)];
