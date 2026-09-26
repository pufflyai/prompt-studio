import { Button, Stack, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { createWorkbench, type Disposable } from "../../../core";
import { WorkbenchStory } from "../../../examples/workbench-story";

const createFixture = (pageOwned: boolean) => {
  const workbench = createWorkbench();
  const pending = Promise.withResolvers<void>();
  const owners: Disposable[] = [];
  const sections = async (id: string) => {
    if (id === "second") await pending.promise;
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
      getBody: async () => {
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
const TreeNavigationLoading = (props: { pageOwned: boolean }) => {
  const { pageOwned } = props;
  const [workbench] = useState(() => createFixture(pageOwned));
  return <WorkbenchStory workbench={workbench} />;
};
const meta = {
  title: "pstdio-workbench/Guides/Tree navigation loading",
  component: TreeNavigationLoading,
  args: { pageOwned: false },
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof TreeNavigationLoading>;
export default meta;
type Story = StoryObj<typeof meta>;
export const PageChange: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("option", { name: "first page action" })).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Switch page" }));
    await waitFor(() => expect(canvas.queryByRole("option", { name: "first page action" })).not.toBeInTheDocument());
    await userEvent.click(canvas.getByRole("button", { name: "Finish loading" }));
    await expect(await canvas.findByRole("option", { name: "second page action" })).toBeVisible();
  },
};

export const PageOwnedActions: Story = { args: { pageOwned: true }, play: PageChange.play };

export const OwnerRemoval: Story = {
  args: { pageOwned: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("option", { name: "first page action" })).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Remove page navigation" }));
    await waitFor(() => expect(canvas.queryByRole("option", { name: "first page action" })).not.toBeInTheDocument());
  },
};
