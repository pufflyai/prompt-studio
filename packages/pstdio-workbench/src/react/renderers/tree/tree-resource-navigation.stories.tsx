import { Button, Stack, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { createWorkbench } from "../../../core";
import { WorkbenchStory } from "../../../examples/workbench-story";

const createFixture = (pageOwned: boolean, resourceDependent: boolean) => {
  const workbench = createWorkbench();
  const pending = Promise.withResolvers<void>();
  const page = { kind: "page", id: "sessions", extensionId: "storybook" } as const;
  const open = (id: string) =>
    workbench.pageLocations.navigate({ kind: "page", page, resource: { type: "session", id } });
  const sections = async () => {
    const id = workbench.pages.store.getState().location?.resource?.id;
    if (id === "second") await pending.promise;
    return [
      {
        id: "sessions",
        nodes: [
          { id: "first", label: "First session" },
          { id: "second", label: "Second session" },
          { id: "current", label: `Loaded ${id}` },
        ],
      },
    ];
  };
  workbench.modes.registerMode({ id: "sessions", activate: () => undefined });
  workbench.views.registerView({
    id: "session-guide",
    title: "Session",
    body: {
      kind: "react",
      render: () => (
        <Stack gap="md" p="md">
          <Text>Shared navigation stays mounted while the next session loads.</Text>
          <Button onClick={() => open("second")}>Open second session</Button>
          <Button onClick={() => pending.resolve()}>Finish loading</Button>
        </Stack>
      ),
    },
  });
  const parent = { kind: "page", id: "session-list", extensionId: "storybook" } as const;
  workbench.pages.registerPage({
    id: parent.id,
    ref: parent,
    title: "Session list",
    path: "session-list",
    modeId: "sessions",
    main: { kind: "view", view: { kind: "view", id: "session-guide" }, cardinality: "one" },
    slots: [],
  });
  workbench.pages.registerPage({
    id: page.id,
    ref: page,
    title: "Sessions",
    path: "sessions",
    modeId: "sessions",
    parentId: parent.id,
    resource: { kinds: [{ kind: "resource-kind", id: "session" }] },
    main: { kind: "view", view: { kind: "view", id: "session-guide" }, cardinality: "one" },
    slots: [],
  });
  const owner = { kind: pageOwned ? ("page" as const) : ("mode" as const), id: page.id, extensionId: "storybook" };
  workbench.navigationTrees.registerContribution({
    id: "sessions",
    owner,
    sourceExtensionId: "storybook",
    declarationIndex: 0,
    ...(!pageOwned && !resourceDependent ? { resolveResource: () => undefined } : {}),
    getSections: sections,
  });
  workbench.views.registerView({
    id: "session-navigation",
    title: "Sessions navigation",
    body: {
      kind: "tree",
      getReadKey: () => workbench.navigationTrees.getReadKey(owner, { resource: workbench.getPrimaryResource() }),
      getBody: () =>
        workbench.navigationTrees.getSections(owner, "content", { resource: workbench.getPrimaryResource() }),
      getChildren: () => [],
    },
  });
  workbench.shellPlacements.registerPlacement({
    id: "session-navigation",
    region: "sidenav",
    item: { kind: "view", presence: "fixed", view: { kind: "view", id: "session-navigation" } },
  });
  workbench.pages.store.subscribe(() => workbench.views.refreshView("session-navigation"));
  workbench.pageLocations.setProject("storybook");
  open("first");
  return workbench;
};

const ResourceNavigation = (props: { pageOwned: boolean; resourceDependent: boolean }) => {
  const { pageOwned, resourceDependent } = props;
  const [workbench] = useState(() => createFixture(pageOwned, resourceDependent));
  return <WorkbenchStory workbench={workbench} />;
};
const meta = {
  title: "pstdio-workbench/Guides/Tree resource navigation",
  component: ResourceNavigation,
  args: { pageOwned: false, resourceDependent: false },
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof ResourceNavigation>;
export default meta;
type Story = StoryObj<typeof meta>;

export const SharedNavigation: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const first = await canvas.findByRole("option", { name: "First session" });
    await userEvent.click(canvas.getByRole("button", { name: "Open second session" }));
    await expect(first).toBeVisible();
    await expect(first).toBe(canvas.getByRole("option", { name: "First session" }));
    await userEvent.click(canvas.getByRole("button", { name: "Finish loading" }));
    await expect(await canvas.findByRole("option", { name: "Loaded second" })).toBeVisible();
    await expect(first).toBe(canvas.getByRole("option", { name: "First session" }));
  },
};

export const PageResourceActions: Story = {
  args: { pageOwned: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("option", { name: "Loaded first" })).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Open second session" }));
    await waitFor(() => expect(canvas.queryByRole("option", { name: "Loaded first" })).not.toBeInTheDocument());
    await userEvent.click(canvas.getByRole("button", { name: "Finish loading" }));
    await expect(await canvas.findByRole("option", { name: "Loaded second" })).toBeVisible();
  },
};

export const ResourceDependentMode: Story = {
  args: { resourceDependent: true },
  play: PageResourceActions.play,
};
