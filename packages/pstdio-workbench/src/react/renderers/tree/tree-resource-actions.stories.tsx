import type { Meta, StoryObj } from "@storybook/react";
import { expect, fireEvent, userEvent, waitFor, within } from "storybook/test";
import { TreeResourceActionsStory } from "./tree-resource-actions-story";

const meta = {
  title: "pstdio-workbench/Guides/Tree resource actions",
  component: TreeResourceActionsStory,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof TreeResourceActionsStory>;

export default meta;
type Story = StoryObj<typeof meta>;

const exerciseRowMenus = async (canvasElement: HTMLElement) => {
  const canvas = within(canvasElement);
  const document = within(canvasElement.ownerDocument.body);
  const ticket = await canvas.findByRole("option", { name: /Write notes/ });
  await fireEvent.contextMenu(ticket);
  await waitFor(() => expect(document.getByRole("menuitem", { name: "Archive ticket" })).toBeVisible());
  await expect(document.getAllByRole("menu")).toHaveLength(1);
  await waitFor(() => expect(document.getByRole("menu")).toHaveFocus());
  await userEvent.keyboard("{Escape}");
  await waitFor(() => expect(document.queryByRole("menu")).not.toBeInTheDocument());

  await fireEvent.contextMenu(canvas.getByRole("option", { name: /notes.md/ }));
  await userEvent.click(await document.findByRole("menuitem", { name: "Rename" }));
  const dialog = await document.findByRole("dialog");
  const name = within(dialog).getByRole("textbox");
  await userEvent.clear(name);
  await userEvent.type(name, "summary.md");
  await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
  await waitFor(() => expect(document.getByText("Renamed notes.md to summary.md")).toBeVisible());

  await fireEvent.contextMenu(canvas.getByRole("option", { name: /Review workspace/ }));
  await waitFor(() => expect(document.getByRole("menuitem", { name: "Archive workspace" })).toBeVisible());
  await expect(document.getByRole("menuitem", { name: "Delete workspace" })).toHaveAttribute("data-disabled");
  await expect(document.queryByRole("menuitem", { name: "Archive ticket" })).not.toBeInTheDocument();
  await waitFor(() => expect(document.getByRole("menu")).toHaveFocus());
  await userEvent.keyboard("{Escape}");
  await waitFor(() => expect(document.queryByRole("menu")).not.toBeInTheDocument());
};

export const Sidenav: Story = {
  args: { region: "sidenav" },
  play: async ({ canvasElement }) => {
    await exerciseRowMenus(canvasElement);
    const sidenav = canvasElement.querySelector('[data-workbench-region="sidenav"]');
    if (!sidenav) throw new Error("Sidenav is missing.");
    await fireEvent.contextMenu(sidenav);
    const document = within(canvasElement.ownerDocument.body);
    await waitFor(() => expect(document.getByRole("menuitem", { name: /Resources/ })).toBeVisible());
    await expect(document.queryByRole("menuitem", { name: "Archive workspace" })).not.toBeInTheDocument();
    await waitFor(() => expect(document.getByRole("menu")).toHaveFocus());
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(document.queryByRole("menu")).not.toBeInTheDocument());
  },
};

export const Standalone: Story = {
  args: { region: "main" },
  play: async ({ canvasElement }) => exerciseRowMenus(canvasElement),
};
