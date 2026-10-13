import { Stack, Text } from "@chakra-ui/react";
import { TreeList } from "@pstdio/ui";
import type { WorkbenchCore } from "../../core";
import { useWorkbenchStore, WorkbenchIcon } from "../../react";
import {
  dashboardFilePaths,
  dashboardFileResource,
  dashboardNote,
  dashboardPages,
  dashboardSessions,
  dashboardWorkspaces,
} from "./dashboard-data";

export const DashboardNavigation = (props: { workbench: WorkbenchCore }) => {
  const { workbench } = props;
  const location = useWorkbenchStore(workbench.pages.store, (state) => state.location);
  const active = useWorkbenchStore(workbench.layout.store, (state) => state.layout.activeResourceKey);
  const workspace = dashboardWorkspaces.find((item) => item.id === location?.resource?.id);
  const activeFile = Object.values(workbench.layout.getLayout().regions)
    .flatMap((region) => region.widgets)
    .find((tab) => tab.resourceKey === active)?.resource;
  let activeNodeId = activeFile?.id ?? location?.resource?.id;
  if (activeFile?.type === "demo.workspace")
    activeNodeId = `${activeFile.id}/${activeFile.metadata?.workspaceFilePath ?? "README.md"}`;
  if (activeFile?.type === "demo.session") activeNodeId = `session-${activeFile.id}`;
  const sections = [
    {
      id: "workspaces",
      label: "Workspaces",
      nodes: dashboardWorkspaces.map((resource) => ({
        id: resource.id,
        label: resource.label,
        icon: <WorkbenchIcon name="Folder" />,
        isNavigable: true,
        onActivate: () => workbench.pageLocations.navigate({ kind: "page", page: dashboardPages.workspace, resource }),
      })),
    },
    ...(workspace
      ? [
          {
            id: "files",
            label: "Files",
            nodes: dashboardFilePaths.map((path) => ({
              id: `${workspace.id}/${path}`,
              label: path,
              icon: <WorkbenchIcon name="FileText" />,
              isNavigable: true,
              onActivate: async () => {
                const resource = dashboardFileResource(workspace, path);
                workbench.pageLocations.navigate({
                  kind: "page",
                  page: dashboardPages.workspace,
                  resource,
                });
                await workbench.navigation.openTarget({
                  kind: "panel",
                  panel: { kind: "page-slot", page: dashboardPages.workspace, id: "files" },
                });
                const files = workbench.layout.getActivePanel();
                if (files?.viewId === "dashboard.files")
                  workbench.layout.updatePanel(files.instanceId, { resource, viewId: "dashboard.files" });
              },
            })),
          },
        ]
      : []),
    {
      id: "notes",
      label: "Notes",
      nodes: [
        {
          id: dashboardNote.id,
          label: dashboardNote.label,
          icon: <WorkbenchIcon name="NotebookPen" />,
          isNavigable: true,
          onActivate: () =>
            workbench.pageLocations.navigate({ kind: "page", page: dashboardPages.note, resource: dashboardNote }),
        },
      ],
    },
    {
      id: "sessions",
      label: "Sessions",
      nodes: dashboardSessions.map((resource) => ({
        id: `session-${resource.id}`,
        label: resource.label,
        icon: <WorkbenchIcon name="MessageCircle" />,
        isNavigable: true,
        onActivate: () =>
          void workbench.navigation.openTarget({
            kind: "panel",
            panel: { kind: "placement", extensionId: "storybook.dashboard", id: "sessions" },
            resource,
            open: "pin",
          }),
      })),
    },
  ];
  return (
    <Stack h="full" gap="md" py="md">
      <Text px="md" textStyle="paragraph/S/semibold">
        Sample project
      </Text>
      <TreeList
        sections={sections}
        expandedSectionIds={sections.map((section) => section.id)}
        activeNodeId={activeNodeId}
      />
      <Text mt="auto" p="md" color="fg.muted" textStyle="paragraph/XS/regular">
        Right-click a tab to move it. Drag a divider to resize a panel.
      </Text>
    </Stack>
  );
};
