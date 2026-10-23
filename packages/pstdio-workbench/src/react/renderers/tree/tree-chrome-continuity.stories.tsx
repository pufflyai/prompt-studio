import { Button, Stack, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import { createLevelNavigation, createWorkbench } from "../../../core";
import { WorkbenchStory } from "../../../examples/workbench-story";

const createFixture = () => {
  const workbench = createWorkbench();
  const navigation = createLevelNavigation(workbench);
  const pending = Promise.withResolvers<void>();
  const page = (id: string) => ({ kind: "page" as const, extensionId: "story", id });
  workbench.modes.registerMode({ id: "project", label: "Project", activate() {} });
  for (const id of ["home", "ticket"]) {
    workbench.views.registerView({
      id,
      title: id,
      body: {
        kind: "react",
        render: () =>
          id === "home" ? (
            <Button onClick={() => workbench.pageLocations.navigate({ kind: "page", page: page("ticket") })}>
              Open ticket
            </Button>
          ) : (
            <Stack>
              <Text>Ticket contents</Text>
              <Button onClick={() => pending.resolve()}>Finish navigation read</Button>
            </Stack>
          ),
      },
    });
    workbench.pages.registerPage({
      id,
      ref: page(id),
      title: id,
      path: id,
      modeId: "project",
      main: { kind: "view", view: { kind: "view", id }, cardinality: "one" },
      slots: [],
    });
  }
  for (const slot of ["header", "footer"] as const) {
    const sections = [{ id: slot, nodes: [{ id: slot, label: slot === "header" ? "Search" : "Help" }] }];
    workbench.navigationTrees.registerContribution({
      id: slot,
      owner: { kind: "mode", extensionId: "pstdio", id: "project" },
      sourceExtensionId: "pstdio",
      declarationIndex: 0,
      slot,
      getStructure: () => sections,
      getSections: () => sections,
    });
  }
  workbench.navigationTrees.registerContribution({
    id: "ticket-files",
    owner: { kind: "page", extensionId: "story", id: "ticket" },
    sourceExtensionId: "story",
    declarationIndex: 0,
    getSections: () => [{ id: "files", nodes: [{ id: "notes", label: "notes.md" }] }],
  });
  workbench.views.registerView({
    id: "navigation",
    title: "Navigation",
    body: {
      kind: "tree",
      getReadKey: () => navigation.getReadKey(),
      getHeaderStructure: () => navigation.getStructure("header"),
      getFooterStructure: () => navigation.getStructure("footer"),
      getHeader: async (context) => {
        if (workbench.pages.store.getState().activePageId === "ticket") await pending.promise;
        return navigation.getSections("header", context.signal, context.onProgress);
      },
      getFooter: (context) => navigation.getSections("footer", context.signal, context.onProgress),
      getBody: (context) => navigation.getSections("content", context.signal, context.onProgress),
      getChildren: () => [],
    },
  });
  workbench.shellPlacements.registerPlacement({
    id: "navigation",
    region: "sidenav",
    item: { kind: "view", presence: "fixed", view: { kind: "view", id: "navigation" } },
  });
  workbench.pageLocations.setProject("story");
  workbench.pageLocations.navigate({ kind: "page", page: page("home") });
  return workbench;
};

const ChromeContinuityStory = () => {
  const [workbench] = useState(createFixture);
  return <WorkbenchStory workbench={workbench} />;
};
const meta = {
  title: "pstdio-workbench/Guides/Navigation chrome continuity",
  component: ChromeContinuityStory,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof ChromeContinuityStory>;
export default meta;
type Story = StoryObj<typeof meta>;

export const OpenTicket: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const search = await canvas.findByRole("option", { name: "Search" });
    const help = await canvas.findByRole("option", { name: "Help" });
    const top = search.getBoundingClientRect().top;
    const bottom = help.getBoundingClientRect().bottom;
    await userEvent.click(await canvas.findByRole("button", { name: "Open ticket" }));
    await canvas.findByText("Ticket contents");
    await expect(search).toBeVisible();
    await expect(help).toBeVisible();
    await expect(search.getBoundingClientRect().top).toBe(top);
    await expect(help.getBoundingClientRect().bottom).toBe(bottom);
    await userEvent.click(canvas.getByRole("button", { name: "Finish navigation read" }));
    await canvas.findByRole("option", { name: "notes.md" });
    await expect(search).toBeVisible();
    await expect(help).toBeVisible();
  },
};
