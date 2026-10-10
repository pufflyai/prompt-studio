import { Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, screen, userEvent, within } from "storybook/test";
import { createWorkbench, resourceContextMenuPath, workbenchBreadcrumbLocationMenuPath } from "../../core";
import { WorkbenchStory } from "../../examples/workbench-story";
import { WorkbenchThemeProvider } from "../theme/workbench-theme-provider";

const boardPage = { kind: "page", extensionId: "storybook", id: "board" } as const;
const ticketPage = { kind: "page", extensionId: "storybook", id: "ticket" } as const;
const ticket = { type: "ticket", id: "PS-1", label: "PS-1 Fix header", extensionId: "storybook" };

const createBreadcrumbWorkbench = (target: {
  page: typeof boardPage | typeof ticketPage;
  resource?: typeof ticket;
}) => {
  const workbench = createWorkbench({ startPage: boardPage });
  workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
  workbench.views.registerView({
    id: "body",
    title: "Body",
    body: { kind: "react", render: () => <Text p="md">Page body</Text> },
  });
  workbench.pages.registerPage({
    id: "board",
    ref: boardPage,
    title: "Board",
    path: "board",
    modeId: "project",
    main: { kind: "panels", empty: { kind: "view", id: "body" } },
    slots: [],
  });
  workbench.pages.registerPage({
    id: "ticket",
    ref: ticketPage,
    path: "ticket",
    modeId: "project",
    resource: { kinds: [{ kind: "resource-kind", id: "ticket" }] },
    main: { kind: "panels", empty: { kind: "view", id: "body" } },
    slots: [],
  });
  // Resource actions also appear when the ticket is a tree row.
  workbench.commands.registerCommand(
    { id: "archive", label: "Archive", icon: "archive" },
    { execute: () => undefined },
  );
  workbench.layout.registerMenuItem(resourceContextMenuPath("ticket"), { commandId: "archive" });
  // Location actions appear only in the breadcrumb menu, on every page.
  workbench.commands.registerCommand(
    { id: "copy-link", label: "Copy link", icon: "link" },
    { execute: () => undefined },
  );
  workbench.layout.registerMenuItem(workbenchBreadcrumbLocationMenuPath, { commandId: "copy-link" });
  workbench.pageLocations.setProject("storybook");
  workbench.pageLocations.navigate({ kind: "page", ...target });
  return workbench;
};

const meta = {
  title: "pstdio-workbench/Reference/Core API/Breadcrumb actions",
  component: WorkbenchStory,
  parameters: { layout: "fullscreen" },
  render: (args) => (
    <WorkbenchThemeProvider>
      <WorkbenchStory {...args} />
    </WorkbenchThemeProvider>
  ),
} satisfies Meta<typeof WorkbenchStory>;
export default meta;
type Story = StoryObj<typeof meta>;

const menuLabels = async () => (await screen.findAllByRole("menuitem")).map((item) => item.textContent);

export const ResourcePage: Story = {
  args: { workbench: createBreadcrumbWorkbench({ page: ticketPage, resource: ticket }) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: "Actions for PS-1 Fix header" }));
    await expect(await menuLabels()).toEqual(["Archive", "Copy link"]);
  },
};

export const PlainPage: Story = {
  args: { workbench: createBreadcrumbWorkbench({ page: boardPage }) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: "Page actions" }));
    await expect(await menuLabels()).toEqual(["Copy link"]);
  },
};
