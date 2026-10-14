import { Stack } from "@chakra-ui/react";
import { ListRow } from "@pstdio/ui";
import { createWorkbench, type ResourceRef } from "../../core";
import { createWindowingPersistence } from "../windowing/adapters";
import {
  createDashboardData,
  dashboardExtensionId,
  dashboardFileIdentity,
  dashboardNote,
  dashboardPages,
  dashboardSessions,
  dashboardWorkspaces,
} from "./dashboard-data";
import { DashboardNavigation } from "./dashboard-navigation";
import { registerDashboardResources } from "./dashboard-resources";
import { createDashboardTerminalModule } from "./dashboard-terminals";
import { DashboardChanges, DashboardConversation, DashboardWorkspaceList } from "./dashboard-views";

export const createDashboardFixture = () => {
  const data = createDashboardData();
  const persistence = createWindowingPersistence();
  const openedTerminalWorkspaces = new Set<string>();
  const create = () => {
    const saved = persistence.pageLocation.load("dashboard-demo");
    const workbench = createWorkbench({
      startPage: dashboardPages.workspaces,
      initialSidePanelMode: "attached",
      defaultPanelOpenByRegionId: { secondary: false, side: true },
      layoutPersistence: persistence.layout,
      pageLocationPersistence: persistence.pageLocation,
    });
    workbench.registerModule(createDashboardTerminalModule(openedTerminalWorkspaces));
    workbench.modes.registerMode({
      id: "dashboard",
      label: "Project",
      chrome: { sidenav: "dashboard.navigation", activity: false },
      regionSettings: {
        sidenav: { size: { defaultPx: 250, minPx: 200 } },
        side: { size: { defaultPx: 400, minPx: 260 }, alwaysShowTabs: true },
        secondary: { size: { defaultPx: 240, minPx: 128 }, alwaysShowTabs: true },
      },
      activate() {},
    });
    workbench.views.registerView({
      id: "dashboard.navigation",
      title: "Project navigation",
      body: { kind: "react", render: () => <DashboardNavigation workbench={workbench} /> },
    });
    const fileBody = {
      kind: "file" as const,
      load: (resource: ResourceRef | undefined) => {
        const file = dashboardFileIdentity(resource!);
        return { fileName: file.path, filePath: file.path, content: data.files.get(file.key)!, editable: true };
      },
      save: (resource: ResourceRef | undefined, content: string) => {
        data.files.set(dashboardFileIdentity(resource!).key, content);
      },
    };
    workbench.views.registerView({ id: "dashboard.file", title: "File", body: fileBody });
    workbench.views.registerView({
      id: "dashboard.changes",
      title: "Changes",
      body: { kind: "react", render: ({ instance }) => <DashboardChanges resource={instance.resource!} /> },
    });
    workbench.views.registerView({ id: "dashboard.files", title: "Files", body: fileBody });
    workbench.views.registerView({
      id: "dashboard.session",
      title: "Session",
      body: {
        kind: "react",
        render: ({ instance }) => <DashboardConversation resource={instance.resource!} data={data} />,
      },
    });
    workbench.views.registerView({
      id: "dashboard.workspaces",
      title: "Workspaces",
      body: {
        kind: "react",
        render: () => (
          <DashboardWorkspaceList
            openWorkspace={(resource) =>
              workbench.pageLocations.navigate({ kind: "page", page: dashboardPages.workspace, resource })
            }
          />
        ),
      },
    });
    workbench.views.registerView({
      id: "dashboard.notes",
      title: "Notes",
      body: {
        kind: "react",
        render: () => (
          <Stack p="lg">
            <ListRow
              label={dashboardNote.label!}
              isNavigable
              onActivate={() =>
                workbench.pageLocations.navigate({ kind: "page", page: dashboardPages.note, resource: dashboardNote })
              }
            />
          </Stack>
        ),
      },
    });
    workbench.modePlacements.registerPlacement({
      id: "dashboard.sessions",
      ref: { kind: "placement", extensionId: dashboardExtensionId, id: "sessions" },
      modeId: "dashboard",
      region: "side",
      item: {
        kind: "binding",
        binding: {
          kinds: [{ kind: "resource-kind", id: "demo.session" }],
          view: { kind: "view", id: "dashboard.session" },
          cardinality: "many",
        },
      },
    });
    workbench.pages.registerPage({
      id: "dashboard.workspaces",
      ref: dashboardPages.workspaces,
      title: "Workspaces",
      path: "workspaces",
      modeId: "dashboard",
      main: { kind: "view", view: { kind: "view", id: "dashboard.workspaces" }, cardinality: "one" },
      slots: [],
    });
    workbench.pages.registerPage({
      id: "dashboard.workspace",
      ref: dashboardPages.workspace,
      document: { metadataKey: "workspaceFilePath" },
      title: "Workspace",
      path: "workspaces/resource",
      parentId: "dashboard.workspaces",
      modeId: "dashboard",
      resource: { kinds: [{ kind: "resource-kind", id: "demo.workspace" }] },
      main: { kind: "panels", empty: { kind: "view", id: "dashboard.workspaces" } },
      slots: [
        {
          id: "changes",
          region: "main",
          tab: { getSnapshot: () => ({ label: "Changes", icon: "GitCompare" }) },
          item: { kind: "view", view: { kind: "view", id: "dashboard.changes" }, presence: "open" },
        },
        {
          id: "files",
          region: "main",
          tab: { getSnapshot: () => ({ label: "Files", icon: "Files" }) },
          item: { kind: "view", view: { kind: "view", id: "dashboard.files" }, presence: "open" },
        },
      ],
    });
    workbench.pages.registerPage({
      id: "dashboard.notes",
      ref: dashboardPages.notes,
      title: "Notes",
      path: "notes",
      modeId: "dashboard",
      main: { kind: "view", view: { kind: "view", id: "dashboard.notes" }, cardinality: "one" },
      slots: [],
    });
    workbench.pages.registerPage({
      id: "dashboard.note",
      ref: dashboardPages.note,
      title: "Notes",
      path: "notes/resource",
      parentId: "dashboard.notes",
      modeId: "dashboard",
      resource: { kinds: [{ kind: "resource-kind", id: "demo.note" }] },
      main: { kind: "view", view: { kind: "view", id: "dashboard.file" }, cardinality: "many" },
      slots: [],
    });
    registerDashboardResources(workbench);
    workbench.pageLocations.switchProject("dashboard-demo");
    if (!saved) {
      workbench.pageLocations.navigate({
        kind: "page",
        page: dashboardPages.workspace,
        resource: dashboardWorkspaces[0],
      });
      void workbench.navigation.openTarget({
        kind: "panel",
        panel: { kind: "placement", extensionId: dashboardExtensionId, id: "sessions" },
        resource: dashboardSessions[0],
        open: "pin",
      });
      const files = workbench.layout.listPanelInstances("main").find((tab) => tab.viewId === "dashboard.files");
      if (files) workbench.layout.activatePanel(files.instanceId);
    }
    return workbench;
  };
  let workbench = create();
  return {
    get workbench() {
      return workbench;
    },
    async reload() {
      await workbench.dispose();
      workbench = create();
    },
    dispose: () => workbench.dispose(),
  };
};
