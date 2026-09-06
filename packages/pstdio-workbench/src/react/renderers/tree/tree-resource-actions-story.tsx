import { Box, Text } from "@chakra-ui/react";
import type { PageRef } from "@pstdio/sdk/extensions";
import { useState } from "react";
import { createWorkbench, type ResourceRef, resourceContextMenuPath, type TreeViewSection } from "../../../core";
import { WorkbenchStory } from "../../../examples/workbench-story";

export const createTreeResourceActionsWorkbench = (region: "sidenav" | "main") => {
  const page: PageRef = { extensionId: "storybook", kind: "page", id: `tree-actions-${region}` };
  const workbench = createWorkbench({ startPage: page });
  const ticket: ResourceRef = { kind: "ticket", uri: "pstdio://ticket/example", id: "ticket", label: "Write notes" };
  const workspace: ResourceRef = {
    kind: "workspace",
    uri: "pstdio://workspace/example",
    id: "workspace",
    label: "Review workspace",
  };
  workbench.modes.registerMode({ id: "tree-actions", label: "Tree actions", activate: () => undefined });
  workbench.commands.registerCommand(
    { id: "ticket.archive", label: "Archive ticket", icon: "Archive" },
    {
      execute: (_args, context) =>
        workbench.notifications.show({ title: `Archived ${context?.resource?.label}`, level: "success" }),
    },
  );
  workbench.commands.registerCommand(
    { id: "workspace.archive", label: "Archive workspace", icon: "Archive" },
    {
      execute: (_args, context) =>
        workbench.notifications.show({ title: `Archived ${context?.resource?.label}`, level: "success" }),
    },
  );
  workbench.commands.registerCommand(
    { id: "workspace.delete", label: "Delete workspace", icon: "Trash" },
    { execute: () => undefined, isEnabled: () => false },
  );
  for (const [kind, commandId] of [
    ["ticket", "ticket.archive"],
    ["workspace", "workspace.archive"],
    ["workspace", "workspace.delete"],
  ]) {
    workbench.layout.registerMenuItem(resourceContextMenuPath(kind), { commandId });
  }

  const sections: TreeViewSection[] = [
    {
      id: "resources",
      label: "Resources",
      canHide: true,
      nodes: [
        { id: "ticket", label: ticket.label!, icon: "Component", resource: ticket },
        {
          id: "file",
          label: "notes.md",
          icon: "FileText",
          contextMenuActions: [
            {
              id: "rename",
              label: "Rename",
              icon: "Pencil",
              args: { name: "notes.md" },
              params: { name: { type: "text", label: "File name", required: true } },
              submitLabel: "Save",
              run: (args) => {
                const name = (args as { name: string }).name;
                workbench.notifications.show({ title: `Renamed notes.md to ${name}`, level: "success" });
              },
            },
            { id: "delete", label: "Delete", icon: "Trash", run: () => undefined },
          ],
        },
        { id: "workspace", label: workspace.label!, icon: "GitBranch", resource: workspace },
        { id: "placeholder", label: "No sessions", disabled: true, rowVariant: "empty-state" },
      ],
    },
  ];
  workbench.views.registerView({
    id: "tree-resource-actions",
    title: "Resource tree",
    body: { kind: "tree", defaultExpandedSectionIds: ["resources"], getBody: () => sections, getChildren: () => [] },
  });
  workbench.views.registerView({
    id: "tree-actions-guide",
    title: "Tree actions",
    body: {
      kind: "react",
      render: () => (
        <Box p="md">
          <Text>
            Right-click a ticket, file, or workspace. Right-click the Sidenav background to customize the tree.
          </Text>
        </Box>
      ),
    },
  });
  workbench.pages.registerPage({
    id: "tree-actions",
    ref: page,
    title: "Tree actions",
    modeId: "tree-actions",
    path: `tree-actions-${region}`,
    slots: [
      {
        id: "content",
        role: "primary",
        region: "main",
        viewId: region === "main" ? "tree-resource-actions" : "tree-actions-guide",
      },
    ],
  });
  if (region === "sidenav") {
    workbench.modePlacements.registerPlacement({
      id: "tree-resource-actions",
      ref: { extensionId: "storybook", kind: "placement", id: "tree-resource-actions" },
      modeId: "tree-actions",
      item: { kind: "view", viewId: "tree-resource-actions", presence: "fixed" },
      region: "sidenav",
    });
  }
  workbench.pageLocations.switchProject(`tree-resource-actions-${region}`);
  return workbench;
};

export const TreeResourceActionsStory = (props: { region: "sidenav" | "main" }) => {
  const { region } = props;
  const [workbench] = useState(() => createTreeResourceActionsWorkbench(region));
  return <WorkbenchStory workbench={workbench} />;
};
