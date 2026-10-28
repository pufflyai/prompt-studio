import { Text } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { HostStorageProvider } from "@pstdio/ui";
import { useState } from "react";
import { createWorkbench } from "../../../core";
import { WorkbenchStory } from "../../../examples/workbench-story";

const TreeGroups = (props: { counts?: boolean; chrome?: boolean }) => {
  const { counts, chrome } = props;
  const [fixture] = useState(() => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => void values.set(key, value),
    };
    const workbench = createWorkbench();
    workbench.modes.registerMode({
      id: "project",
      label: "Project",
      chrome: chrome ? { sidenav: "group-navigation" } : undefined,
      activate: () => undefined,
    });
    workbench.views.registerView({
      id: "group-navigation",
      title: "Navigation",
      body: {
        kind: "tree",
        canMove: ({ source, destination }) => source.moveScope === destination.moveScope,
        getHeader: () => [
          { id: "header", moveScope: "project", nodes: [{ id: "search", label: "Search", canHide: true }] },
        ],
        getBody: () => [
          {
            id: "navigation",
            moveScope: "project",
            nodes: [
              { id: "tickets", label: "Tickets", canHide: true },
              ...(counts
                ? [
                    {
                      id: "requests",
                      label: "Review requests",
                      icon: "message-circle-warning",
                      badge: { label: "3", color: "orange" },
                    },
                    {
                      id: "resolved",
                      label: "Resolved requests",
                      icon: "message-circle-warning",
                      badge: { label: "3", color: "green" },
                    },
                  ]
                : []),
            ],
          },
        ],
        getChildren: () => [],
      },
    });
    workbench.views.registerView({
      id: "group-guide",
      title: "Tree groups",
      body: {
        kind: "react",
        render: () => (
          <Text p="md">
            Right-click the Sidenav to create a group. Drag rows into its header. Use the group menu to rename or remove
            it.
          </Text>
        ),
      },
    });
    workbench.pages.registerPage({
      id: "groups",
      ref: { kind: "page", id: "groups", extensionId: "storybook" },
      title: "Tree groups",
      path: "groups",
      modeId: "project",
      main: { kind: "view", view: { kind: "view", id: "group-guide" }, cardinality: "one" },
      slots: [],
    });
    workbench.shellPlacements.registerPlacement({
      id: "group-navigation",
      region: "sidenav",
      item: { kind: "view", presence: "fixed", view: { kind: "view", id: "group-navigation" } },
    });
    workbench.pageLocations.setProject("tree-groups");
    workbench.pageLocations.navigate({ kind: "page", page: { kind: "page", id: "groups", extensionId: "storybook" } });
    return { workbench, storage };
  });
  return (
    <HostStorageProvider storage={fixture.storage}>
      <WorkbenchStory workbench={fixture.workbench} />
    </HostStorageProvider>
  );
};
const meta = {
  title: "pstdio-workbench/Guides/Tree groups",
  component: TreeGroups,
  parameters: { layout: "fullscreen" },
  tags: ["tree-groups"],
} satisfies CanvasMeta<typeof TreeGroups>;
export default meta;
type Story = CanvasVariant<typeof meta>;
export const Default: Story = {
  id: "pstdio-workbench-guides-tree-groups--default",
};
export const CountBadges: Story = {
  id: "pstdio-workbench-guides-tree-groups--count-badges",
  args: { counts: true },
};
export const CreateAndRename: Story = {
  id: "pstdio-workbench-guides-tree-groups--create-and-rename",
};
export const ModeChromeGroups: Story = {
  id: "pstdio-workbench-guides-tree-groups--mode-chrome-groups",
  args: { chrome: true },
};
export const ReorderGroups: Story = {
  id: "pstdio-workbench-guides-tree-groups--reorder-groups",
};
