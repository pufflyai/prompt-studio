import type {
  WorkbenchExtensionMetadata as DashboardExtensionMetadata,
  ListExtensionAppearanceResponse,
} from "@pstdio/sdk/api";
import type { ThemePreferenceOption } from "@pstdio/ui";
import type {
  Disposable,
  WorkbenchModuleContribution,
  WorkbenchModuleContributionContext,
} from "pstdio-workbench/core";
import { type CollectionChange, subscribeCollections } from "@/lib/sync/collections";
import { getDashboardSelectedProjectId, subscribeDashboardSelectedProject } from "@/shared/app/project-context";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import {
  executeExtensionCommand,
  getProjectExtensionAppearance,
  getProjectExtensionMetadata,
} from "@/shared/extensions/api";
import {
  buildDashboardExtensionMenuRegistrations,
  buildDashboardExtensionRouteEntries,
  buildDashboardExtensionTreeSections,
  clearCachedDashboardExtensionMetadata,
  dashboardExtensionRouteKind,
  emptyDashboardExtensionMetadata,
  getCachedDashboardExtensionMetadata,
  setCachedDashboardExtensionMetadata,
} from "@/shared/extensions/workbench-extension-contributions";
import {
  registerProjectSidebarContribution,
  registerWorkspaceSidebarContribution,
} from "@/shared/workbench/contributions/sidebar-tree-contributions";
import { setResourceBreadcrumb } from "@/shared/workbench/resource-sync";
import { readActiveResource, syncActiveResourceContext } from "./active-resource-context";
import { ExtensionRouteWidget } from "./components/extension-route-widget";
import { ExtensionViewWidget } from "./components/extension-view-widget";
import { createExtensionMenuCommandHandler, type ExecuteDashboardExtensionCommand } from "./extension-command-handler";
import { dashboardExtensionViewKind, registerExtensionModeContributions } from "./extension-mode-layout";

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

const extensionSyncTables = new Set<CollectionChange["table"]>(["installed_extension_sources", "extension_instances"]);

const disposeAll = (disposables: Disposable[]) => {
  for (let index = disposables.length - 1; index >= 0; index -= 1) {
    disposables[index]?.dispose();
  }
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
        contributionDisposables.push(...registerExtensionModeContributions(ctx, nextMetadata, nextProjectId));

        if (ctx.renderers.getTreeRenderer(dashboardWidgetIds.projectSidebar)) {
          ctx.renderers.refresh(dashboardWidgetIds.projectSidebar);
        }
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
      ctx.resources.registerKind({ kind: dashboardExtensionViewKind, label: "Extension view", icon: "PanelLeft" });
      registerProjectSidebarContribution(ctx, {
        id: "dashboard.extensions.project-sidebar.first",
        order: 10,
        placement: "beforeWorkspaces",
        getSections: () => {
          if (!projectId) return [];
          const navigationMetadata = getCachedDashboardExtensionMetadata(projectId) ?? metadata;
          return navigationMetadata
            ? [
                ...buildDashboardExtensionTreeSections({
                  metadata: navigationMetadata,
                  modeId: "project",
                  placement: "first",
                  projectId,
                  target: "workbench.left.tree",
                }),
              ]
            : [];
        },
      });
      registerProjectSidebarContribution(ctx, {
        id: "dashboard.extensions.project-sidebar.default",
        order: 20,
        getSections: () => {
          if (!projectId) return [];
          const navigationMetadata = getCachedDashboardExtensionMetadata(projectId) ?? metadata;
          return navigationMetadata
            ? [
                ...buildDashboardExtensionTreeSections({
                  metadata: navigationMetadata,
                  modeId: "project",
                  placement: "default",
                  projectId,
                  target: "workbench.left.tree",
                }),
              ]
            : [];
        },
      });
      registerWorkspaceSidebarContribution(ctx, {
        id: "dashboard.extensions.workspace-sidebar",
        order: 20,
        getSections: () => {
          if (!projectId) return [];
          const navigationMetadata = getCachedDashboardExtensionMetadata(projectId) ?? metadata;
          return navigationMetadata
            ? buildDashboardExtensionTreeSections({
                metadata: navigationMetadata,
                modeId: "workspace",
                projectId,
                target: "workbench.left.tree",
              })
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
      ctx.renderers.registerRenderer({
        id: dashboardWidgetIds.extensionView,
        render: (renderInput) => <ExtensionViewWidget input={renderInput} />,
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
          if (ctx.renderers.getTreeRenderer(dashboardWidgetIds.projectSidebar)) {
            ctx.renderers.setSelectedNode(dashboardWidgetIds.projectSidebar, resource.uri);
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
      const unsubscribeExtensionSync = subscribeCollections((change) => {
        if (!change || !extensionSyncTables.has(change.table)) return;
        refreshProject();
      });

      return {
        dispose() {
          requestId += 1;
          activeResourceContext.dispose();
          clearCachedDashboardExtensionMetadata(projectId);
          clearContributions();
          clearAppearance();
          unsubscribeProject();
          unsubscribeExtensionSync();
        },
      };
    },
  }) satisfies WorkbenchModuleContribution;
