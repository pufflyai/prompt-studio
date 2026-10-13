import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { createWindowingFixture } from "./fixture";
import { visibleWindowingLabel } from "./visible-label";
import { WindowingStory } from "./windowing-story";

const meta = {
  title: "pstdio-workbench/Guides/Windowing",
  component: WindowingStory,
  parameters: { layout: "fullscreen" },
  args: { createFixture: () => createWindowingFixture("windowing", { pagePanels: true, removalControls: true }) },
} satisfies Meta<typeof WindowingStory>;
export default meta;
type Story = StoryObj<typeof meta>;

const move = async (element: HTMLElement, name: string, destination: string) => {
  within(element)
    .getByRole("tab", { name: new RegExp(`^${name}(?: ·|$)`) })
    .focus();
  await userEvent.keyboard("{Shift>}{F10}{/Shift}");
  await userEvent.click(await within(document.body).findByRole("menuitem", { name: `Move to ${destination}` }));
};
const panel = (element: HTMLElement, region: string) =>
  element.querySelector(`[data-workbench-panel="${region}"]`) as HTMLElement;
const sessionInPage = async (element: HTMLElement) => {
  await userEvent.click(within(element).getByRole("button", { name: "Session 2" }));
  await move(panel(element, "side"), "Session 2", "Main");
  await waitFor(() =>
    expect(within(element).getByLabelText("Session 2 runtime")).toHaveTextContent("Starts 1 · Stops 0 · Running"),
  );
};
const running = async (element: HTMLElement, name = "Session 2") => {
  await expect(within(element).getByLabelText(`${name} runtime`)).toHaveTextContent("Starts 1 · Stops 0 · Running");
};

export const RemovedWorkspaceResource: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const workspaceButton = (name: string) =>
      within(canvas.getByRole("group", { name: "Windowing controls" })).getByRole("button", { name });
    await userEvent.click(workspaceButton("Workspace 2"));
    await waitFor(() =>
      expect(visibleWindowingLabel(canvasElement, "Terminal binding")).toHaveTextContent("workspace-2"),
    );
    await move(panel(canvasElement, "bottom"), "Terminal", "Side");
    await userEvent.click(workspaceButton("Workspace 1"));
    await move(panel(canvasElement, "side"), "Terminal", "Page bottom");
    await sessionInPage(canvasElement);
    const removedView = canvas.getByRole("group", { name: "Session view" });
    await userEvent.click(canvas.getByRole("button", { name: "Delete Workspace 1" }));
    await waitFor(() => expect(canvas.queryByRole("tab", { name: /^Session 2(?: ·|$)/ })).not.toBeInTheDocument());
    await expect(canvas.queryByRole("tab", { name: /^Terminal(?: ·|$)/ })).not.toBeInTheDocument();
    await expect(removedView).not.toBeInTheDocument();
    await running(canvasElement);
    await running(canvasElement, "Terminal 2");
    await userEvent.click(canvas.getByRole("button", { name: "Try Workspace 1" }));
    await expect(canvas.getByLabelText("Removal result")).toHaveTextContent("Resource was deleted");
    await userEvent.click(canvas.getByRole("button", { name: "Reload fixture" }));
    await waitFor(() => expect(canvas.getByRole("heading", { name: "Workspaces" })).toBeVisible());
    await expect(canvas.queryByRole("tab", { name: /^Session 2(?: ·|$)/ })).not.toBeInTheDocument();
    await userEvent.click(workspaceButton("Workspace 2"));
    await userEvent.click(canvas.getByRole("button", { name: "Reopen Session 2" }));
    await expect(within(panel(canvasElement, "side")).getByRole("tab", { name: /^Session 2(?: ·|$)/ })).toBeVisible();
    await running(canvasElement);
    await move(panel(canvasElement, "side"), "Session 2", "Page bottom");
    await userEvent.click(canvas.getByRole("button", { name: "Reset layout" }));
    await expect(canvas.getAllByRole("tab", { name: /^Session 2(?: ·|$)/ })).toHaveLength(1);
    await running(canvasElement);
  },
};

export const RemovedWorkspaceContribution: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await sessionInPage(canvasElement);
    const removedView = canvas.getByRole("group", { name: "Session view" });
    await userEvent.click(canvas.getByRole("button", { name: "Remove workspace contribution" }));
    await waitFor(() => expect(canvas.queryByRole("tab", { name: /^Session 2(?: ·|$)/ })).not.toBeInTheDocument());
    await expect(removedView).not.toBeInTheDocument();
    await expect(canvas.getByRole("heading", { name: "Workspaces" })).toBeVisible();
    await running(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Try Workspace 1" }));
    await expect(canvas.getByLabelText("Removal result")).toHaveTextContent("Unknown page");
    await userEvent.click(canvas.getByRole("button", { name: "Reopen Session 2" }));
    await expect(canvas.getAllByRole("tab", { name: /^Session 2(?: ·|$)/ })).toHaveLength(1);
    await expect(within(panel(canvasElement, "side")).getByRole("tab", { name: /^Session 2(?: ·|$)/ })).toBeVisible();
    await running(canvasElement);
  },
};

export const RemovedPanelContribution: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await sessionInPage(canvasElement);
    const removedView = canvas.getByRole("group", { name: "Session view" });
    await userEvent.click(canvas.getByRole("button", { name: "Remove panel contribution" }));
    await waitFor(() => expect(canvas.queryByRole("tab", { name: /^Session 2(?: ·|$)/ })).not.toBeInTheDocument());
    await expect(removedView).not.toBeInTheDocument();
    await running(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Reopen Session 2" }));
    await expect(canvas.getByLabelText("Removal result")).toHaveTextContent("Cannot open navigation panel target");
  },
};

export const RemovedModeContribution: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await sessionInPage(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Remove mode contribution" }));
    await userEvent.click(canvas.getByRole("button", { name: "Try Workspace 1" }));
    await expect(canvas.getByLabelText("Removal result")).toHaveTextContent("mode not registered");
    await running(canvasElement);
  },
};

export const RemovedSessionResource: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await sessionInPage(canvasElement);
    const removedView = canvas.getByRole("group", { name: "Session view" });
    await userEvent.click(canvas.getByRole("button", { name: "Delete Session 2" }));
    await waitFor(() => expect(canvas.queryByRole("tab", { name: /^Session 2(?: ·|$)/ })).not.toBeInTheDocument());
    await expect(removedView).not.toBeInTheDocument();
    await expect(visibleWindowingLabel(canvasElement, "Inspector binding")).toHaveTextContent("Workspace 1");
    await running(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Reset layout" }));
    await expect(canvas.queryByRole("tab", { name: /^Session 2(?: ·|$)/ })).not.toBeInTheDocument();
  },
};

export const RemovedOwnerForbiddenReopen: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await sessionInPage(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Delete Workspace 1" }));
    await userEvent.click(canvas.getByRole("button", { name: "Forbid Sidebar" }));
    await userEvent.click(canvas.getByRole("button", { name: "Reopen Session 2" }));
    await expect(canvas.getByLabelText("Removal result")).toHaveTextContent("cannot open");
    await expect(canvas.queryByRole("tab", { name: /^Session 2(?: ·|$)/ })).not.toBeInTheDocument();
    await running(canvasElement);
  },
};
