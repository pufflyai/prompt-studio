import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { createWindowingFixture } from "./fixture";
import { visibleWindowingLabel } from "./visible-label";
import { WindowingStory } from "./windowing-story";

const meta = {
  title: "pstdio-workbench/Guides/Windowing",
  component: WindowingStory,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof WindowingStory>;
export default meta;
type Story = StoryObj<typeof meta>;

const moveTab = async (panel: HTMLElement, name: string, destination: string) => {
  const tab = within(panel).getByRole("tab", { name });
  tab.focus();
  await userEvent.keyboard("{Shift>}{F10}{/Shift}");
  await userEvent.click(await within(document.body).findByRole("menuitem", { name: `Move to ${destination}` }));
};

export const OwnerTransfer: Story = {
  args: { createFixture: () => createWindowingFixture("windowing", { pagePanels: true }) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const main = canvasElement.querySelector('[data-workbench-panel-header="main"]') as HTMLElement;
    await userEvent.click(within(main).getByRole("tab", { name: "Changes" }));
    const draft = canvas.getByRole("textbox", { name: "Changes draft" });
    await userEvent.type(draft, "Keep this workspace draft");
    await userEvent.click(within(canvas.getByRole("group", { name: "Changes view" })).getByText("README.md"));
    const mount = visibleWindowingLabel(canvasElement, "Changes mount").textContent;
    await moveTab(main, "Changes", "Side");
    const side = canvasElement.querySelector('[data-workbench-panel="side"]') as HTMLElement;
    await expect(within(side).getByRole("textbox", { name: "Changes draft" })).toHaveValue("Keep this workspace draft");
    await userEvent.click(canvas.getByRole("button", { name: "Grow Secondary" }));
    const size = visibleWindowingLabel(canvasElement, "Secondary size").textContent;
    await userEvent.click(canvas.getByRole("button", { name: "Workspace 2" }));
    await waitFor(() =>
      expect(visibleWindowingLabel(canvasElement, "Inspector binding")).toHaveTextContent("Workspace 2"),
    );
    await expect(within(side).getByRole("textbox", { name: "Changes draft" })).toHaveValue("Keep this workspace draft");
    await expect(within(side).getByLabelText("Changes selected file")).toHaveTextContent("README.md");
    await expect(within(side).getByLabelText("Changes mount")).toHaveTextContent(mount!);
    await expect(within(side).getByText(/Changes ·/)).toHaveTextContent("workspace-1");
    await expect(visibleWindowingLabel(canvasElement, "Secondary size")).toHaveTextContent(size!);
    const bottom = canvasElement.querySelector('[data-workbench-panel="bottom"]') as HTMLElement;
    await expect(bottom).toBeVisible();
    await expect(canvasElement.querySelector('[data-workbench-panel="secondary"]')).toBeVisible();
    await expect(visibleWindowingLabel(bottom, "Terminal binding")).toHaveTextContent("workspace-2");
    await expect(visibleWindowingLabel(bottom, "Terminal lifecycle")).toHaveTextContent("Starts 1 · Stops 0");
    await moveTab(side, "Changes", "Page bottom");
    await userEvent.click(canvas.getByRole("button", { name: "Workspace 1" }));
    await expect(canvas.queryByRole("textbox", { name: "Changes draft" })).toBeNull();
    await userEvent.click(canvas.getByRole("button", { name: "Workspace 2" }));
    await expect(canvas.getByRole("textbox", { name: "Changes draft" })).toHaveValue("Keep this workspace draft");
    await userEvent.click(canvas.getByRole("button", { name: "Reload fixture" }));
    await waitFor(() =>
      expect(visibleWindowingLabel(canvasElement, "Inspector binding")).toHaveTextContent("Workspace 2"),
    );
    await expect(
      within(canvasElement.querySelector('[data-workbench-panel="bottom"]') as HTMLElement).getByRole("tab", {
        name: "Changes",
      }),
    ).toBeVisible();
  },
};

export const FilesTransfer: Story = {
  args: { createFixture: () => createWindowingFixture("windowing", { pagePanels: true }) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const main = canvasElement.querySelector('[data-workbench-panel-header="main"]') as HTMLElement;
    await userEvent.click(within(main).getByRole("tab", { name: "Files" }));
    await userEvent.type(canvas.getByRole("textbox", { name: "Files draft" }), "Keep Files draft");
    await userEvent.click(canvas.getByText("README.md"));
    const mount = visibleWindowingLabel(canvasElement, "Files mount").textContent;
    await moveTab(main, "Files", "Side");
    await userEvent.click(canvas.getByRole("button", { name: "Workspace 2" }));
    const side = canvasElement.querySelector('[data-workbench-panel="side"]') as HTMLElement;
    await expect(within(side).getByRole("textbox", { name: "Files draft" })).toHaveValue("Keep Files draft");
    await expect(within(side).getByLabelText("Files selected file")).toHaveTextContent("README.md");
    await expect(within(side).getByLabelText("Files mount")).toHaveTextContent(mount!);
    await expect(within(side).getByText(/Files ·/)).toHaveTextContent("workspace-1");
    await moveTab(main, "Changes", "Secondary");
    const secondary = canvasElement.querySelector('[data-workbench-panel="secondary"]') as HTMLElement;
    await moveTab(secondary, "Mode tools", "Main");
    await userEvent.click(canvas.getByRole("button", { name: "Workspace 1" }));
    await expect(within(secondary).queryByRole("tab", { name: "Mode tools" })).not.toBeInTheDocument();
    await expect(within(secondary).getByText(/Changes ·/)).toHaveTextContent("workspace-2");
    await userEvent.click(canvas.getByRole("button", { name: "Workspace 2" }));
    await expect(within(main).getByRole("tab", { name: "Mode tools" })).toBeVisible();
    await expect(within(secondary).queryByRole("tab", { name: "Mode tools" })).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Session 1" }));
    await moveTab(side, "Session 1", "Main");
    await userEvent.click(within(main).getByRole("tab", { name: "Mode tools" }));
    await userEvent.click(canvas.getByRole("button", { name: "Session 1" }));
    await expect(within(main).getByRole("tab", { name: "Session 1" })).toHaveAttribute("aria-selected", "true");
    await userEvent.click(canvas.getByRole("button", { name: "Workspace 1" }));
    await expect(within(main).queryByRole("tab", { name: "Session 1" })).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Session 1" }));
    await expect(within(side).getByRole("tab", { name: "Session 1" })).toHaveAttribute("aria-selected", "true");
    await userEvent.click(canvas.getByRole("button", { name: "Workspace 2" }));
    await expect(within(main).getByRole("tab", { name: "Session 1" })).toBeVisible();
    await expect(within(side).getByRole("tab", { name: "Session 1" })).toBeVisible();
  },
};
