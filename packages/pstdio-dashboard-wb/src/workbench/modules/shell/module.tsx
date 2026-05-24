import type { WorkbenchModuleContribution, WorkbenchModuleContributionContext } from "pstdio-workbench/core";
import { createDashboardProjects, findDashboardProject } from "../../data/project-data";
import { getDashboardSelectedProjectId, selectDashboardProject } from "../../shared/project-context";
import type { DashboardProjectSelectionPersistence } from "../../shared/project-selection-persistence";
import { dashboardResources } from "../../shared/resources";
import { dashboardWidgetIds } from "../../shared/widget-ids";
import { registerCommands, registerMenus } from "./commands";
import { CreateProjectWidget } from "./components/create-project-widget";
import { DashboardLeftHeader } from "./components/dashboard-left-header";
import { DashboardMainHeader } from "./components/dashboard-main-header";
import { KeyboardShortcutsWidget } from "./components/keyboard-shortcuts-widget";
import { ProjectPickerWidget } from "./components/project-picker-widget";

const LEFT_HEADER_WIDGET_ID = "dashboard.leftHeader";

interface CreateShellModuleInput {
  projectSelectionPersistence?: DashboardProjectSelectionPersistence;
}

const shellResourceKinds = [{ kind: "dashboard-view", label: "Dashboard view", icon: "LayoutDashboard" }] as const;

const projectSelectionContentAreas = [
  "left",
  "main-left",
  "main",
  "main-right",
  "main-bottom",
  "floating-header",
  "floating",
  "overlay",
] as const;

const projectSelectionOverlayWidgetIds = new Set<string>([
  dashboardWidgetIds.projectPicker,
  dashboardWidgetIds.createProject,
]);

const closeProjectSelectionOverlays = (ctx: WorkbenchModuleContributionContext) => {
  const overlayWidgets = ctx.layout.getLayout().areas.overlay.widgets;

  for (const placement of overlayWidgets) {
    if (projectSelectionOverlayWidgetIds.has(placement.contributionId)) {
      ctx.layout.removeWidgetPlacement(placement.widgetId);
    }
  }
};

const resetProjectModeOnProjectChange = (
  ctx: WorkbenchModuleContributionContext,
  previousProjectId: string | undefined,
  nextProjectId: string,
) => {
  if (previousProjectId === nextProjectId) return;
  if (ctx.modes.getActiveModeId() !== "project") return;

  ctx.modes.setActiveMode(undefined);
};

const registerChrome = (ctx: WorkbenchModuleContributionContext) => {
  ctx.layout.registerWidget(
    {
      id: dashboardWidgetIds.header,
      title: "Dashboard header",
      area: "top",
      singleton: true,
      rendererId: dashboardWidgetIds.header,
      priority: 100,
    },
    { priority: 100 },
  );
  ctx.renderers.registerRenderer({
    id: dashboardWidgetIds.header,
    render: (input) => <DashboardMainHeader input={input} />,
  });

  ctx.layout.registerWidget({
    id: LEFT_HEADER_WIDGET_ID,
    title: "Project brand",
    area: "left-header",
    singleton: true,
    rendererId: LEFT_HEADER_WIDGET_ID,
    headerBorderBottom: false,
  });
  ctx.renderers.registerRenderer({
    id: LEFT_HEADER_WIDGET_ID,
    render: (input) => <DashboardLeftHeader workbench={input.workbench} />,
  });

  ctx.layout.registerWidget({
    id: dashboardWidgetIds.shortcutHelp,
    title: "Keyboard shortcuts",
    area: "overlay",
    singleton: true,
    closable: true,
    rendererId: dashboardWidgetIds.shortcutHelp,
    config: { size: "md", placement: "center", scrollBehavior: "inside" },
  });
  ctx.renderers.registerRenderer({
    id: dashboardWidgetIds.shortcutHelp,
    render: (input) => <KeyboardShortcutsWidget input={input} />,
  });

  ctx.layout.registerWidget({
    id: dashboardWidgetIds.projectPicker,
    title: "Projects",
    area: "overlay",
    singleton: true,
    closable: true,
    rendererId: dashboardWidgetIds.projectPicker,
    config: { size: "lg", placement: "center", scrollBehavior: "inside" },
  });
  ctx.renderers.registerRenderer({
    id: dashboardWidgetIds.projectPicker,
    render: (input) => <ProjectPickerWidget input={input} />,
  });

  ctx.layout.registerWidget({
    id: dashboardWidgetIds.createProject,
    title: "Create project",
    area: "overlay",
    singleton: true,
    closable: true,
    rendererId: dashboardWidgetIds.createProject,
    config: { size: "lg", placement: "center", scrollBehavior: "inside", closeOnInteractOutside: false },
  });
  ctx.renderers.registerRenderer({
    id: dashboardWidgetIds.createProject,
    render: (input) => <CreateProjectWidget input={input} />,
  });

  ctx.layout.openWidget(dashboardWidgetIds.header, { pinned: true });
  ctx.layout.openWidget(LEFT_HEADER_WIDGET_ID, { pinned: true });
};

const registerProjectSelectionMode = (ctx: WorkbenchModuleContributionContext) => {
  ctx.modes.registerMode({
    id: "project-selection",
    label: "Projects",
    activate(modeCtx) {
      for (const area of projectSelectionContentAreas) modeCtx.layout.clearArea(area);
      modeCtx.layout.openWidget(dashboardWidgetIds.projectPicker, { title: "Projects", closable: false });
      return undefined;
    },
  });
};

const registerProjects = (
  ctx: WorkbenchModuleContributionContext,
  persistence: DashboardProjectSelectionPersistence | undefined,
) => {
  const selectedProjectContext = { context: ctx.context.createScope("dashboard.selectedProject") };

  ctx.resources.registerKind({ kind: "project", label: "Project", icon: "FolderGit2" });

  ctx.resources.registerProvider({
    id: "dashboard-workbench.projects",
    kind: "project",
    list: (query) => {
      const normalizedQuery = query.trim().toLowerCase();
      const projects = createDashboardProjects().filter((project) => {
        if (!normalizedQuery) return true;
        return (
          project.name.toLowerCase().includes(normalizedQuery) ||
          (project.repoPath ?? "").toLowerCase().includes(normalizedQuery)
        );
      });

      return projects.map((project) => ({
        resource: project.resource,
        description: project.repoPath ?? undefined,
        group: "Projects",
      }));
    },
  });

  ctx.resources.registerOpener({
    id: "dashboard.projects.opener",
    priority: 1000,
    canOpen: (resource) => resource.kind === "project",
    open: (resource, input) => {
      const project = findDashboardProject(resource.id) ?? {
        id: resource.id ?? resource.uri,
        name: resource.label ?? resource.id ?? resource.uri,
      };
      const previousProjectId = getDashboardSelectedProjectId(ctx);

      selectDashboardProject(selectedProjectContext, project, persistence);
      resetProjectModeOnProjectChange(ctx, previousProjectId, project.id);
      closeProjectSelectionOverlays(ctx);
      if (ctx.renderers.getTreeRenderer(dashboardWidgetIds.workspaceSidebar)) {
        ctx.renderers.refresh(dashboardWidgetIds.workspaceSidebar);
      }
      if (ctx.renderers.getTreeRenderer(dashboardWidgetIds.sessionsSidebar)) {
        ctx.renderers.refresh(dashboardWidgetIds.sessionsSidebar);
      }
      return ctx.resources.openResource(dashboardResources.workspaces, { replaceActive: input.replaceActive });
    },
  });
};

// The shell slice: the workbench chrome (header, brand) and the global command
// palette.
export const createShellModule = (input: CreateShellModuleInput = {}) =>
  ({
    id: "dashboard.shell",
    activate(ctx) {
      for (const kind of shellResourceKinds) ctx.resources.registerKind(kind);

      registerChrome(ctx);
      registerProjectSelectionMode(ctx);
      registerProjects(ctx, input.projectSelectionPersistence);
      registerCommands(ctx);
      registerMenus(ctx);

      ctx.resources.registerProvider({
        id: "dashboard-workbench.dashboard-views",
        kind: "dashboard-view",
        list: () => [
          { resource: dashboardResources.workspaces, group: "Dashboard" },
          { resource: dashboardResources.sessions, group: "Dashboard" },
        ],
      });
    },
  }) satisfies WorkbenchModuleContribution;
