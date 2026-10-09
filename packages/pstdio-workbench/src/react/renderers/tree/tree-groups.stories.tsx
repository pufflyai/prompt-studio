import { Text } from "@chakra-ui/react";
import { HostStorageProvider } from "@pstdio/ui";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, fireEvent, userEvent, within } from "storybook/test";
import { createWorkbench } from "../../../core";
import { WorkbenchStory } from "../../../examples/workbench-story";

const TreeGroups = () => {
  const [fixture] = useState(() => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => void values.set(key, value),
    };
    const workbench = createWorkbench();
    workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
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
          { id: "navigation", moveScope: "project", nodes: [{ id: "tickets", label: "Tickets", canHide: true }] },
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
} satisfies Meta<typeof TreeGroups>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const CreateAndRename: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const document = within(canvasElement.ownerDocument.body);
    fireEvent.contextMenu(await canvas.findByRole("option", { name: "Search" }));
    await userEvent.click(await document.findByRole("menuitem", { name: "New group" }));
    await userEvent.type(await canvas.findByRole("textbox", { name: "Group name" }), "Research{Enter}");
    fireEvent.contextMenu(await canvas.findByText("Research"));
    await userEvent.click(await document.findByRole("menuitem", { name: "Rename group" }));
    const input = await canvas.findByRole("textbox", { name: "Group name" });
    await userEvent.clear(input);
    await userEvent.type(input, "Product research{Enter}");
    await expect(canvas.getByText("Product research")).toBeVisible();
  },
};
