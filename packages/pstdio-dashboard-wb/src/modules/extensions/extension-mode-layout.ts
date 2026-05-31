import type { WorkbenchExtensionMetadata as DashboardExtensionMetadata } from "@pstdio/sdk/api";
import type { Disposable, WorkbenchModuleContributionContext } from "pstdio-workbench/core";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";

type DashboardExtensionMode = DashboardExtensionMetadata["modes"][number];
type DashboardExtensionView = DashboardExtensionMetadata["views"][number];
type ModeLayoutOpenEntry = NonNullable<NonNullable<DashboardExtensionMode["layout"]>["open"]>[number];

export const dashboardExtensionViewKind = "extension-view";

const targetArea = {
  "workbench.left": "left",
  "workbench.main.left": "main-left",
  "workbench.main": "main",
  "workbench.main.right": "main-right",
  "workbench.main.bottom": "main-bottom",
} as const;

const defaultResetTargets = [
  "workbench.left",
  "workbench.main.left",
  "workbench.main",
  "workbench.main.right",
  "workbench.main.bottom",
] as const;

const nativeModeResourceKinds = new Map([["sessions", { kind: "session", label: "Session", icon: "MessageCircle" }]]);

export const extensionViewWidgetId = (viewId: string) => `${dashboardWidgetIds.extensionView}.${viewId}`;

export const extensionViewArea = (target: DashboardExtensionView["target"] | undefined) =>
  target ? targetArea[target] : "main";

const createExtensionViewResource = (input: { projectId: string; view: DashboardExtensionView; title?: string }) => ({
  kind: dashboardExtensionViewKind,
  uri: `dashboard-workbench://project/${input.projectId}/extension-views/${input.view.id}`,
  id: input.view.id,
  label: input.title ?? input.view.title,
  metadata: {
    extensionId: input.view.extensionId,
    projectId: input.projectId,
    view: input.view,
  },
});

const resetTargets = (reset: DashboardExtensionMode["layout"] extends infer T ? T : never) => {
  if (!reset || typeof reset !== "object" || !("reset" in reset)) return [];
  if (reset.reset === true) return [...defaultResetTargets];
  return Array.isArray(reset.reset) ? reset.reset : [];
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
  const area = targetArea[entry.target];

  if (entry.view) {
    const view = viewById.get(entry.view);
    if (!view) throw new Error(`Extension mode view not found: ${entry.view}`);
    return ctx.layout.openWidget(extensionViewWidgetId(view.id), {
      area,
      pinned: entry.pinned,
      resource: createExtensionViewResource({ projectId, title: entry.title, view }),
      title: entry.title ?? view.title,
    });
  }

  if (!entry.resource) return undefined;
  const resource = resolveResource(ctx, entry.resource);
  if (!resource) throw new Error(`Extension mode resource not found: ${entry.resource}`);
  if (entry.widget) {
    return ctx.layout.openWidget(entry.widget, {
      area,
      pinned: entry.pinned,
      resource,
      title: entry.title ?? resource.label,
    });
  }
  return ctx.resources.openResource(resource);
};

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

  for (const target of resetTargets(mode.layout)) ctx.layout.clearArea(targetArea[target]);
  for (const entry of entries) openModeEntry({ ctx, entry, projectId, viewById });
};

const registerExtensionViews = (ctx: WorkbenchModuleContributionContext, metadata: DashboardExtensionMetadata) => {
  const disposables: Disposable[] = [];

  for (const view of metadata.views) {
    disposables.push(
      ctx.layout.registerWidget({
        id: extensionViewWidgetId(view.id),
        title: view.title,
        area: extensionViewArea(view.target),
        rendererId: dashboardWidgetIds.extensionView,
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
          label: mode.label,
          activate(modeCtx) {
            activateExtensionModeLayout({ ctx: modeCtx, metadata, mode, projectId });
            return undefined;
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
