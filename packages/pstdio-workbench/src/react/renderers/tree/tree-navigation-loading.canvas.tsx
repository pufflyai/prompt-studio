import { Button, Stack, Text } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { useState } from "react";
import { createLevelNavigation, createWorkbench, type Disposable } from "../../../core";
import { WorkbenchStory } from "../../../examples/workbench-story";

const createFixture = (pageOwned: boolean, composed: boolean) => {
  const workbench = createWorkbench();
  const navigation = createLevelNavigation(workbench);
  const pending = Promise.withResolvers<void>();
  const owners: Disposable[] = [];
  const sections = async (id: string) => {
    if (id === "second" && !composed) await pending.promise;
    return [{ id: "navigation", nodes: [{ id: "destination", label: `${id} page action` }] }];
  };
  const open = (id: string) =>
    workbench.pageLocations.navigate({ kind: "page", page: { kind: "page", id, extensionId: "storybook" } });
  workbench.views.registerView({
    id: "navigation-tree",
    title: "Navigation",
    body: {
      kind: "tree",
      getChildren: () => [],
      ...(composed ? { getReadKey: () => navigation.getReadKey() } : {}),
      getBody: async (context) => {
        if (composed) return navigation.getSections("content", context.signal, context.onProgress);
        const id = workbench.pages.store.getState().activePageId!;
        return pageOwned
          ? workbench.navigationTrees.getSections({ kind: "page", id, extensionId: "storybook" })
          : sections(id);
      },
    },
  });
  workbench.views.registerView({
    id: "navigation-guide",
    title: "Navigation loading",
    body: {
      kind: "react",
      render: () => (
        <Stack gap="md" p="md">
          <Text>Switch pages while the next navigation query is held. The previous page's action must disappear.</Text>
          <Button onClick={() => open("second")}>Switch page</Button>
          <Button onClick={() => pending.resolve()}>Finish loading</Button>
          {pageOwned && (
            <Button
              onClick={() => {
                for (const owner of owners) owner.dispose();
              }}
            >
              Remove page navigation
            </Button>
          )}
        </Stack>
      ),
    },
  });
  for (const id of ["first", "second"]) {
    workbench.modes.registerMode({ id, label: id, activate: () => undefined });
    workbench.pages.registerPage({
      id,
      ref: { kind: "page", id, extensionId: "storybook" },
      title: id,
      path: id,
      modeId: pageOwned ? "first" : id,
      main: { kind: "view", view: { kind: "view", id: "navigation-guide" }, cardinality: "one" },
      slots: [],
    });
  }
  if (pageOwned) {
    for (const id of ["first", "second"]) {
      owners.push(
        workbench.navigationTrees.registerContribution({
          id,
          owner: { kind: "page", id, extensionId: "storybook" },
          sourceExtensionId: "storybook",
          declarationIndex: 0,
          getSections: () => sections(id),
        }),
      );
    }
  }
  if (composed) {
    workbench.navigationTrees.registerContribution({
      id: "project-files",
      owner: { kind: "mode", id: "first", extensionId: "pstdio" },
      sourceExtensionId: "pstdio",
      declarationIndex: 0,
      getSections: async () => {
        if (workbench.pages.store.getState().activePageId === "second") await pending.promise;
        return [];
      },
    });
  }
  workbench.pages.store.subscribe(() => workbench.views.refreshView("navigation-tree"));
  workbench.shellPlacements.registerPlacement({
    id: "navigation-tree",
    region: "sidenav",
    item: { kind: "view", presence: "fixed", view: { kind: "view", id: "navigation-tree" } },
  });
  workbench.pageLocations.setProject("storybook");
  open("first");
  return workbench;
};
const TreeNavigationLoading = (props: { pageOwned: boolean; composed?: boolean }) => {
  const { pageOwned, composed = false } = props;
  const [workbench] = useState(() => createFixture(pageOwned, composed));
  return <WorkbenchStory workbench={workbench} />;
};
const meta = {
  title: "pstdio-workbench/Guides/Tree navigation loading",
  component: TreeNavigationLoading,
  args: { pageOwned: false },
  parameters: { layout: "fullscreen" },
} satisfies CanvasMeta<typeof TreeNavigationLoading>;
export default meta;
type Story = CanvasVariant<typeof meta>;
export const PageChange: Story = {
  id: "pstdio-workbench-guides-tree-navigation-loading--page-change",
};
export const PageOwnedActions: Story = {
  id: "pstdio-workbench-guides-tree-navigation-loading--page-owned-actions",
  args: { pageOwned: true },
};
export const SlowProjectNavigation: Story = {
  id: "pstdio-workbench-guides-tree-navigation-loading--slow-project-navigation",
  args: { pageOwned: true, composed: true },
};
export const OwnerRemoval: Story = {
  id: "pstdio-workbench-guides-tree-navigation-loading--owner-removal",
  args: { pageOwned: true },
};
