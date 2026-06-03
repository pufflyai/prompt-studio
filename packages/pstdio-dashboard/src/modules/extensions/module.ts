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
import { createElement } from "react";
import i18n from "@/i18n";
import { type CollectionChange, subscribeCollections } from "@/lib/sync/collections";
import { getDashboardSelectedProjectId, subscribeDashboardSelectedProject } from "@/shared/app/project-context";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import {
  executeExtensionCommand,
  getProjectExtensionAppearance,
  getProjectExtensionMetadata,
} from "@/shared/extensions/api";
import {
  localizeExtensionAppearance,
  localizeExtensionMetadata,
  type ResolvedWorkbenchExtensionAppearance,
  type ResolvedWorkbenchExtensionMetadata,
  registerExtensionTranslationBundles,
} from "@/shared/extensions/extension-localization";
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
  sidebarTreeContributionPlacements,
} from "@/shared/workbench/contributions/sidebar-tree-contributions";
import { setResourceBreadcrumb } from "@/shared/workbench/resource-sync";
import { readActiveResource, syncActiveResourceContext } from "./active-resource-context";
import { ExtensionRouteWidget } from "./components/extension-route-widget";
import { ExtensionViewWidget } from "./components/extension-view-widget";
import { createExtensionMenuCommandHandler, type ExecuteDashboardExtensionCommand } from "./extension-command-handler";
import { buildExtensionDataRendererSidebarSections, registerExtensionDataRenderers } from "./extension-data-renderers";
import {
  dashboardExtensionViewKind,
  extensionViewArea,
  extensionViewWidgetId,
  registerExtensionModeContributions,
} from "./extension-mode-layout";
import { registerExtensionResourceView } from "./extension-resource-view";
import { registerExtensionSettingsPanels } from "./extension-settings-panels";

type LoadDashboardExtensionMetadata = (projectId: string) => Promise<DashboardExtensionMetadata>;
type LoadDashboardExtensionAppearance = (projectId: string) => Promise<ListExtensionAppearanceResponse>;

interface CreateExtensionsModuleInput {
  executeCommand?: ExecuteDashboardExtensionCommand;
  loadAppearance?: LoadDashboardExtensionAppearance;
  loadMetadata?: LoadDashboardExtensionMetadata;
}

const emptyDashboardExtensionAppearance = {
  themes: [],
  fileIconThemes: [],
  translations: [],
  diagnostics: [],
} satisfies ListExtensionAppearanceResponse;

const extensionSyncTables = new Set<CollectionChange["table"]>(["installed_extension_sources", "extension_instances"]);

const disposeAll = (disposables: Disposable[]) => {
  for (let index = disposables.length - 1; index >= 0; index -= 1) disposables[index]?.dispose();
};

const registerExtensionContributions = (input: {
  ctx: WorkbenchModuleContributionContext;
  executeCommand: ExecuteDashboardExtensionCommand;
  metadata: ResolvedWorkbenchExtensionMetadata;
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

  disposables.push(...registerExtensionDataRenderers(ctx, { metadata, projectId }));
  disposables.push(...registerExtensionModeContributions(ctx, metadata, projectId));
  disposables.push(...registerExtensionResourceView(ctx, { metadata }));
  disposables.push(...registerExtensionSettingsPanels(ctx, { metadata, projectId }));
  return disposables;
};

const toThemePreference = (theme: ResolvedWorkbenchExtensionAppearance["themes"][number]) =>
  ({
    id: theme.id,
    title: theme.title,
    mode: theme.mode,
    tokens: theme.tokens,
    monacoTheme: theme.monacoTheme,
  }) satisfies ThemePreferenceOption;

const registerExtensionAppearance = (
  ctx: WorkbenchModuleContributionContext,
  rawAppearance: ListExtensionAppearanceResponse,
) => {
  const translationDisposable = registerExtensionTranslationBundles(rawAppearance);
  const appearance = localizeExtensionAppearance(rawAppearance);
  const themeDisposable =
    appearance.themes.length > 0 ? ctx.themes.register(appearance.themes.map(toThemePreference)) : undefined;
  return {
    dispose() {
      themeDisposable?.dispose();
      translationDisposable.dispose();
    },
  };
};

// Extension metadata is fetched per project and re-applied whenever the active
// project or installed-extension collections change.
export const createExtensionsModule = (input: CreateExtensionsModuleInput = {}) =>
  ({
    id: "dashboard.extensions",
    activate(ctx: WorkbenchModuleContributionContext) {
      const executeCommand = input.executeCommand ?? executeExtensionCommand;
      const loadAppearance = input.loadAppearance ?? getProjectExtensionAppearance;
      const loadMetadata = input.loadMetadata ?? getProjectExtensionMetadata;
      let projectId = getDashboardSelectedProjectId(ctx);
      let rawAppearance: ListExtensionAppearanceResponse | undefined;
      let rawMetadata: DashboardExtensionMetadata | undefined;
      let metadata: ResolvedWorkbenchExtensionMetadata | undefined;
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
        rawAppearance = nextAppearance;
        clearAppearance();
        appearanceDisposable = registerExtensionAppearance(ctx, nextAppearance);
      };

      const applyMetadata = (nextProjectId: string, nextMetadata: DashboardExtensionMetadata) => {
        rawMetadata = nextMetadata;
        metadata = localizeExtensionMetadata(nextMetadata);
        setCachedDashboardExtensionMetadata(nextProjectId, metadata);
        clearContributions();
        contributionDisposables = registerExtensionContributions({
          ctx,
          executeCommand,
          metadata,
          projectId: nextProjectId,
        });
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
        rawAppearance = undefined;
        rawMetadata = undefined;
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
            if (rawMetadata) applyMetadata(projectId, rawMetadata);
          });
      };

      const reapplyLocale = () => {
        if (!projectId || !rawMetadata || !rawAppearance) return;
        applyAppearance(rawAppearance);
        applyMetadata(projectId, rawMetadata);
      };

      ctx.resources.registerKind({ kind: dashboardExtensionRouteKind, label: "Extension route", icon: "PanelLeft" });
      ctx.resources.registerKind({ kind: dashboardExtensionViewKind, label: "Extension view", icon: "PanelLeft" });
      registerProjectSidebarContribution(ctx, {
        id: "dashboard.extensions.project-sidebar.first",
        order: 10,
        placement: sidebarTreeContributionPlacements.beforeWorkspaces,
        getSections: () => {
          if (!projectId) return [];
          const navigationMetadata = getCachedDashboardExtensionMetadata(projectId) ?? metadata;
          return navigationMetadata
            ? buildDashboardExtensionTreeSections({
                metadata: navigationMetadata,
                modeId: "project",
                placement: "first",
                projectId,
                target: "workbench.left.tree",
              })
            : [];
        },
      });
      registerProjectSidebarContribution(ctx, {
        id: "dashboard.extensions.data-renderers",
        order: 15,
        getSections: () =>
          buildExtensionDataRendererSidebarSections({
            metadata: getCachedDashboardExtensionMetadata(projectId) ?? metadata,
            projectId,
          }),
      });
      registerProjectSidebarContribution(ctx, {
        id: "dashboard.extensions.project-sidebar.default",
        order: 20,
        getSections: () => {
          if (!projectId) return [];
          const navigationMetadata = getCachedDashboardExtensionMetadata(projectId) ?? metadata;
          return navigationMetadata
            ? buildDashboardExtensionTreeSections({
                metadata: navigationMetadata,
                modeId: "project",
                placement: "default",
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
        render: (renderInput) => createElement(ExtensionRouteWidget, { input: renderInput }),
      });
      ctx.renderers.registerRenderer({
        id: dashboardWidgetIds.extensionView,
        render: (renderInput) => createElement(ExtensionViewWidget, { input: renderInput }),
      });
      ctx.resources.registerProvider({
        id: "dashboard-workbench.extension-routes",
        kind: dashboardExtensionRouteKind,
        list: () => buildDashboardExtensionRouteEntries({ metadata, projectId }),
      });
      // A mode-layout view docked in the primary area (e.g. an extension overview) is recorded
      // as an `extension-view` history landmark. Back/Forward replay reopens it through this
      // opener, which re-derives the view from the cached manifest and re-places the widget.
      // Without it, replaying that entry would silently leave the primary area desynced from the
      // history cursor (there is no opener for the synthetic `extension-view` kind otherwise).
      ctx.resources.registerOpener({
        id: "dashboard.extensions.view-opener",
        priority: 1000,
        canOpen: (resource) => resource.kind === dashboardExtensionViewKind,
        open: (resource, openInput) => {
          const viewProjectId =
            typeof resource.metadata?.projectId === "string" ? resource.metadata.projectId : projectId;
          const view = getCachedDashboardExtensionMetadata(viewProjectId)?.views.find(
            (candidate) => candidate.id === resource.id,
          );
          if (!view) return undefined;
          return ctx.layout.openWidget(extensionViewWidgetId(view.id), {
            resource,
            area: extensionViewArea(view.target),
            title: resource.label,
            replaceActive: openInput.replaceActive,
          });
        },
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
      i18n.on("languageChanged", reapplyLocale);
      const unsubscribeProject = subscribeDashboardSelectedProject(ctx, refreshProject);
      const unsubscribeSync = subscribeCollections((change) => {
        if (change && extensionSyncTables.has(change.table)) refreshProject();
      });

      return {
        dispose() {
          requestId += 1;
          activeResourceContext.dispose();
          clearCachedDashboardExtensionMetadata(projectId);
          clearContributions();
          clearAppearance();
          i18n.off("languageChanged", reapplyLocale);
          unsubscribeProject();
          unsubscribeSync();
        },
      };
    },
  }) satisfies WorkbenchModuleContribution;
