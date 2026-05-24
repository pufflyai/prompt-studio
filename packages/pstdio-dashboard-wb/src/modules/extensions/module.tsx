import type { DashboardExtensionMetadata, ListExtensionAppearanceResponse } from "@pstdio/sdk/api";
import type { ThemePreferenceOption } from "@pstdio/ui";
import type {
  Disposable,
  WorkbenchModuleContribution,
  WorkbenchModuleContributionContext,
} from "pstdio-workbench/core";
import {
  executeExtensionCommand,
  getProjectExtensionAppearance,
  getProjectExtensionMetadata,
} from "../../shared/extensions/api";
import {
  buildDashboardExtensionMenuRegistrations,
  buildDashboardExtensionNavigationSections,
  buildDashboardExtensionRouteEntries,
  clearCachedDashboardExtensionMetadata,
  dashboardActiveResourceIdContextKey,
  dashboardActiveResourceKindContextKey,
  dashboardActiveResourceMetadataContextKey,
  dashboardExtensionRouteKind,
  emptyDashboardExtensionMetadata,
  getCachedDashboardExtensionMetadata,
  setCachedDashboardExtensionMetadata,
} from "../../shared/extensions/workbench-extension-contributions";
import { getDashboardSelectedProjectId, subscribeDashboardSelectedProject } from "../../shared/project-context";
import { setResourceBreadcrumb } from "../../shared/resource-sync";
import { dashboardWidgetIds } from "../../shared/widget-ids";
import { registerWorkspaceSidebarContribution } from "../../shared/workspace-sidebar-contributions";
import { ExtensionRouteWidget } from "./components/extension-route-widget";
import { createExtensionMenuCommandHandler, type ExecuteDashboardExtensionCommand } from "./extension-command-handler";

type LoadDashboardExtensionMetadata = (projectId: string) => Promise<DashboardExtensionMetadata>;
type LoadDashboardExtensionAppearance = (projectId: string) => Promise<ListExtensionAppearanceResponse>;

interface CreateExtensionContributionsModuleInput {
  loadAppearance?: LoadDashboardExtensionAppearance;
  loadMetadata?: LoadDashboardExtensionMetadata;
  executeCommand?: ExecuteDashboardExtensionCommand;
}

const emptyDashboardExtensionAppearance = {
  themes: [],
  fileIconThemes: [],
  diagnostics: [],
} satisfies ListExtensionAppearanceResponse;

const disposeAll = (disposables: Disposable[]) => {
  for (let index = disposables.length - 1; index >= 0; index -= 1) {
    disposables[index]?.dispose();
  }
};

const readActivePlacement = (ctx: WorkbenchModuleContributionContext) => {
  const { activeWidgetId, areas } = ctx.layout.getLayout();
  if (!activeWidgetId) return undefined;

  for (const area of Object.values(areas)) {
    const placement = area.widgets.find((candidate) => candidate.widgetId === activeWidgetId);
    if (placement) return placement;
  }

  return undefined;
};

const readActiveResource = (ctx: WorkbenchModuleContributionContext) => readActivePlacement(ctx)?.resource;

const isContextPrimitive = (value: unknown) =>
  typeof value === "string" || typeof value === "number" || typeof value === "boolean";

const syncActiveResourceContext = (ctx: WorkbenchModuleContributionContext) => {
  const activeMetadataKeys = new Set<string>();

  const clearMetadataContext = () => {
    for (const key of activeMetadataKeys) ctx.context.delete(key);
    activeMetadataKeys.clear();
  };

  const applyResource = () => {
    const resource = readActiveResource(ctx);

    clearMetadataContext();
    if (!resource) {
      ctx.context.delete(dashboardActiveResourceKindContextKey);
      ctx.context.delete(dashboardActiveResourceIdContextKey);
      return;
    }

    ctx.context.set(dashboardActiveResourceKindContextKey, resource.kind);
    ctx.context.set(dashboardActiveResourceIdContextKey, resource.id ?? resource.uri);

    for (const [key, value] of Object.entries(resource.metadata ?? {})) {
      if (!isContextPrimitive(value)) continue;
      const contextKey = dashboardActiveResourceMetadataContextKey(key);
      activeMetadataKeys.add(contextKey);
      ctx.context.set(contextKey, value);
    }
  };

  const unsubscribe = ctx.layout.store.subscribeSelector(
    (state) => {
      const activeWidgetId = state.layout.activeWidgetId;
      if (!activeWidgetId) return "";

      for (const area of Object.values(state.layout.areas)) {
        const placement = area.widgets.find((candidate) => candidate.widgetId === activeWidgetId);
        if (placement) return `${placement.widgetId}:${placement.resourceUri ?? ""}`;
      }

      return "";
    },
    applyResource,
    { fireImmediately: true },
  );

  return {
    dispose() {
      unsubscribe();
      clearMetadataContext();
      ctx.context.delete(dashboardActiveResourceKindContextKey);
      ctx.context.delete(dashboardActiveResourceIdContextKey);
    },
  };
};

const registerExtensionContributions = (input: {
  ctx: WorkbenchModuleContributionContext;
  executeCommand: ExecuteDashboardExtensionCommand;
  metadata: DashboardExtensionMetadata;
  projectId: string;
}) => {
  const { ctx, executeCommand, metadata, projectId } = input;
  const disposables: Disposable[] = [];

  for (const registration of buildDashboardExtensionMenuRegistrations(metadata)) {
    disposables.push(
      ctx.commands.registerCommand(
        registration.command,
        createExtensionMenuCommandHandler({
          ctx,
          contribution: registration.contribution,
          executeCommand,
          getActiveResource: () => readActiveResource(ctx),
          projectId,
        }),
      ),
    );
    disposables.push(ctx.layout.registerMenuItem(registration.menuPath, registration.menuItem));
  }

  return disposables;
};

const toThemePreference = (theme: ListExtensionAppearanceResponse["themes"][number]) =>
  ({
    id: theme.id,
    title: theme.title,
    mode: theme.mode,
    tokens: theme.tokens,
    monacoTheme: theme.monacoTheme,
  }) satisfies ThemePreferenceOption;

const registerExtensionAppearance = (
  ctx: WorkbenchModuleContributionContext,
  appearance: ListExtensionAppearanceResponse,
) => {
  if (appearance.themes.length === 0) return undefined;
  return ctx.themes.register(appearance.themes.map(toThemePreference));
};

export const createExtensionContributionsModule = (input: CreateExtensionContributionsModuleInput = {}) =>
  ({
    id: "dashboard.extensions",
    activate(ctx) {
      const loadAppearance = input.loadAppearance ?? getProjectExtensionAppearance;
      const loadMetadata = input.loadMetadata ?? getProjectExtensionMetadata;
      const executeCommand = input.executeCommand ?? executeExtensionCommand;
      let metadata: DashboardExtensionMetadata | undefined;
      let projectId = getDashboardSelectedProjectId(ctx);
      let requestId = 0;
      let appearanceDisposable: Disposable | undefined;
      let contributionDisposables: Disposable[] = [];

      const clearContributions = () => {
        disposeAll(contributionDisposables);
        contributionDisposables = [];
      };

      const clearAppearance = () => {
        appearanceDisposable?.dispose();
        appearanceDisposable = undefined;
      };

      const applyAppearance = (nextAppearance: ListExtensionAppearanceResponse) => {
        clearAppearance();
        appearanceDisposable = registerExtensionAppearance(ctx, nextAppearance);
      };

      const applyMetadata = (nextProjectId: string, nextMetadata: DashboardExtensionMetadata) => {
        metadata = nextMetadata;
        setCachedDashboardExtensionMetadata(nextProjectId, nextMetadata);
        clearContributions();
        contributionDisposables = registerExtensionContributions({
          ctx,
          executeCommand,
          metadata: nextMetadata,
          projectId: nextProjectId,
        });

        if (ctx.renderers.getTreeRenderer(dashboardWidgetIds.workspaceSidebar)) {
          ctx.renderers.refresh(dashboardWidgetIds.workspaceSidebar);
        }
      };

      const refreshProject = () => {
        const previousProjectId = projectId;
        projectId = getDashboardSelectedProjectId(ctx);
        metadata = undefined;
        clearCachedDashboardExtensionMetadata(previousProjectId);
        clearCachedDashboardExtensionMetadata(projectId);
        clearContributions();
        clearAppearance();

        if (!projectId) return;

        requestId += 1;
        const currentRequestId = requestId;
        void loadMetadata(projectId)
          .catch(() => emptyDashboardExtensionMetadata)
          .then((nextMetadata) => {
            if (currentRequestId !== requestId || !projectId) return;
            applyMetadata(projectId, nextMetadata);
          });
        void loadAppearance(projectId)
          .catch(() => emptyDashboardExtensionAppearance)
          .then((nextAppearance) => {
            if (currentRequestId !== requestId || !projectId) return;
            applyAppearance(nextAppearance);
          });
      };

      ctx.resources.registerKind({ kind: dashboardExtensionRouteKind, label: "Extension route", icon: "PanelLeft" });
      registerWorkspaceSidebarContribution(ctx, {
        id: "dashboard.extensions.workspace-sidebar",
        order: 20,
        getSections: () => {
          if (!projectId) return [];
          const navigationMetadata = getCachedDashboardExtensionMetadata(projectId) ?? metadata;
          return navigationMetadata
            ? buildDashboardExtensionNavigationSections({ metadata: navigationMetadata, projectId })
            : [];
        },
      });
      ctx.layout.registerWidget(
        {
          id: dashboardWidgetIds.extensionRoute,
          title: "Extension route",
          area: "main",
          singleton: true,
          rendererId: dashboardWidgetIds.extensionRoute,
          priority: 70,
        },
        { priority: 70 },
      );
      ctx.renderers.registerRenderer({
        id: dashboardWidgetIds.extensionRoute,
        render: (renderInput) => <ExtensionRouteWidget input={renderInput} />,
      });

      ctx.resources.registerProvider({
        id: "dashboard-workbench.extension-routes",
        kind: dashboardExtensionRouteKind,
        list: () => buildDashboardExtensionRouteEntries({ metadata, projectId }),
      });

      ctx.resources.registerOpener({
        id: "dashboard.extensions.route-opener",
        priority: 1000,
        canOpen: (resource) => resource.kind === dashboardExtensionRouteKind,
        open: (resource, openInput) => {
          ctx.modes.setActiveMode("project");
          setResourceBreadcrumb(ctx, resource);
          if (ctx.renderers.getTreeRenderer(dashboardWidgetIds.workspaceSidebar)) {
            ctx.renderers.setSelectedNode(dashboardWidgetIds.workspaceSidebar, resource.uri);
          }
          return ctx.layout.openWidget(dashboardWidgetIds.extensionRoute, {
            resource,
            title: resource.label,
            replaceActive: openInput.replaceActive,
          });
        },
      });

      const activeResourceContext = syncActiveResourceContext(ctx);

      refreshProject();
      const unsubscribeProject = subscribeDashboardSelectedProject(ctx, refreshProject);

      return {
        dispose() {
          requestId += 1;
          activeResourceContext.dispose();
          clearCachedDashboardExtensionMetadata(projectId);
          clearContributions();
          clearAppearance();
          unsubscribeProject();
        },
      };
    },
  }) satisfies WorkbenchModuleContribution;
